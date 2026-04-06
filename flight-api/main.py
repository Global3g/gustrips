from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from cachetools import TTLCache
import hashlib
import json
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from firebase_client import initialize_firebase, get_db
from price_checker import check_alert_prices

# Importar Fli
try:
    from fli.search.flights import SearchFlights
    from fli.models import (
        Airport,
        PassengerInfo,
        SeatType,
        MaxStops,
        SortBy,
        FlightSearchFilters,
        FlightSegment,
        TripType,
    )
    FLI_AVAILABLE = True
    print("✅ Fli cargado correctamente")
except ImportError as e:
    print(f"⚠️  Error al importar Fli: {e}")
    print("   Ejecuta: pip install flights")
    FLI_AVAILABLE = False

app = FastAPI(
    title="GusTrips Flight API",
    description="API para búsqueda de vuelos usando Fli (Google Flights)",
    version="1.0.0"
)

# Configurar CORS
import os
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caché en memoria (30 minutos de TTL)
cache = TTLCache(maxsize=100, ttl=1800)

# Inicializar Firebase
initialize_firebase()

# Inicializar Scheduler
scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    # Schedule price checks every hour
    scheduler.add_job(check_alert_prices, 'interval', hours=1, id='price_check')
    scheduler.start()
    print("✅ Scheduler started - checking prices every hour")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    scheduler.shutdown()
    print("👋 Scheduler stopped")


def get_cache_key(params: Dict[str, Any]) -> str:
    """Genera una clave única para el caché basada en los parámetros"""
    params_str = json.dumps(params, sort_keys=True)
    return hashlib.md5(params_str.encode()).hexdigest()


def parse_iata_to_airport(iata_code: str) -> Airport:
    """Convierte código IATA a enum Airport de Fli"""
    try:
        return Airport[iata_code.upper()]
    except KeyError:
        # Si no está en el enum, usar el código como string
        # Fli puede manejar códigos IATA directamente
        return Airport(iata_code.upper())


def parse_cabin_class(cabin_class: str) -> SeatType:
    """Convierte clase de cabina a enum SeatType"""
    mapping = {
        "ECONOMY": SeatType.ECONOMY,
        "PREMIUM_ECONOMY": SeatType.PREMIUM_ECONOMY,
        "BUSINESS": SeatType.BUSINESS,
        "FIRST": SeatType.FIRST,
    }
    return mapping.get(cabin_class.upper(), SeatType.ECONOMY)


def parse_max_stops(max_stops: str) -> MaxStops:
    """Convierte parámetro de escalas a enum MaxStops"""
    mapping = {
        "ANY": MaxStops.ANY,
        "NON_STOP": MaxStops.NON_STOP,
        "ONE_STOP": MaxStops.ONE_STOP_OR_FEWER,
        "TWO_PLUS_STOPS": MaxStops.TWO_OR_FEWER_STOPS,
    }
    return mapping.get(max_stops.upper(), MaxStops.ANY)


def parse_sort_by(sort_by: str) -> SortBy:
    """Convierte parámetro de ordenamiento a enum SortBy"""
    mapping = {
        "CHEAPEST": SortBy.CHEAPEST,
        "DURATION": SortBy.DURATION,
        "DEPARTURE_TIME": SortBy.DEPARTURE_TIME,
        "ARRIVAL_TIME": SortBy.ARRIVAL_TIME,
    }
    return mapping.get(sort_by.upper(), SortBy.CHEAPEST)


def generate_google_flights_url(origin: str, destination: str, departure_date: str, return_date: Optional[str] = None) -> str:
    """Genera URL de Google Flights para comprar el vuelo"""
    base_url = "https://www.google.com/travel/flights"

    # Formato: ?q=Flights from ORIGIN to DEST on DATE
    query = f"Flights from {origin.upper()} to {destination.upper()} on {departure_date}"

    if return_date:
        query += f" returning {return_date}"

    # URL encode
    from urllib.parse import urlencode
    params = {"q": query}

    return f"{base_url}?{urlencode(params)}"


# ─── Modelos ───────────────────────────────────────────

class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    departure_date: str
    return_date: Optional[str] = None
    cabin_class: Optional[str] = "ECONOMY"
    max_stops: Optional[str] = "ANY"
    sort_by: Optional[str] = "CHEAPEST"
    passengers: Optional[int] = 1


class DateSearchRequest(BaseModel):
    origin: str
    destination: str
    start_date: str
    end_date: str
    trip_duration: Optional[int] = 7
    is_round_trip: Optional[bool] = True
    cabin_class: Optional[str] = "ECONOMY"


class CreateAlertRequest(BaseModel):
    userId: str
    email: str
    origin: str
    destination: str
    targetPrice: float
    currency: Optional[str] = "USD"


# ─── Endpoints ─────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "GusTrips Flight API",
        "status": "online",
        "fli_available": FLI_AVAILABLE,
        "docs": "/docs"
    }


@app.get("/api/flights/search")
async def search_flights_endpoint(
    origin: str = Query(..., description="Código IATA de origen (ej. GDL)"),
    destination: str = Query(..., description="Código IATA de destino (ej. CUN)"),
    departure_date: str = Query(..., description="Fecha de salida (YYYY-MM-DD)"),
    return_date: Optional[str] = Query(None, description="Fecha de regreso (YYYY-MM-DD)"),
    cabin_class: str = Query("ECONOMY", description="ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST"),
    max_stops: str = Query("ANY", description="ANY, NON_STOP, ONE_STOP, TWO_PLUS_STOPS"),
    sort_by: str = Query("CHEAPEST", description="CHEAPEST, DURATION, DEPARTURE_TIME, ARRIVAL_TIME"),
    passengers: int = Query(1, description="Número de pasajeros"),
):
    """
    Busca vuelos usando la API de Google Flights vía Fli
    """
    if not FLI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El servicio de búsqueda de vuelos no está disponible"
        )

    # Generar clave de caché
    cache_params = {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "return_date": return_date,
        "cabin_class": cabin_class,
        "max_stops": max_stops,
        "sort_by": sort_by,
        "passengers": passengers,
    }
    cache_key = get_cache_key(cache_params)

    # Verificar caché
    if cache_key in cache:
        print(f"✓ Cache hit para {origin} → {destination}")
        return {
            "cached": True,
            "flights": cache[cache_key]
        }

    try:
        # Validar fecha
        try:
            datetime.strptime(departure_date, "%Y-%m-%d")
            if return_date:
                datetime.strptime(return_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Formato de fecha inválido. Use YYYY-MM-DD"
            )

        print(f"🔍 Buscando vuelos {origin} → {destination} ({departure_date})")

        # Crear segmentos de vuelo
        segments = [
            FlightSegment(
                departure_airport=[[parse_iata_to_airport(origin), 0]],
                arrival_airport=[[parse_iata_to_airport(destination), 0]],
                travel_date=departure_date,
            )
        ]

        # Si hay fecha de regreso, agregar segmento de vuelta
        trip_type = TripType.ONE_WAY
        if return_date:
            trip_type = TripType.ROUND_TRIP
            segments.append(
                FlightSegment(
                    departure_airport=[[parse_iata_to_airport(destination), 0]],
                    arrival_airport=[[parse_iata_to_airport(origin), 0]],
                    travel_date=return_date,
                )
            )

        # Crear filtros de búsqueda
        filters = FlightSearchFilters(
            passenger_info=PassengerInfo(adults=passengers),
            flight_segments=segments,
            seat_type=parse_cabin_class(cabin_class),
            stops=parse_max_stops(max_stops),
            sort_by=parse_sort_by(sort_by),
            trip_type=trip_type,
        )

        # Realizar búsqueda
        search = SearchFlights()
        results = search.search(filters)

        # Procesar resultados
        flights = []
        if results:
            for flight in results:
                # Procesar legs (segmentos del vuelo)
                legs_data = []
                for leg in flight.legs:
                    legs_data.append({
                        "airline": str(leg.airline.value) if hasattr(leg.airline, 'value') else str(leg.airline),
                        "flight_number": str(leg.flight_number),
                        "departure_airport": str(leg.departure_airport.value) if hasattr(leg.departure_airport, 'value') else str(leg.departure_airport),
                        "arrival_airport": str(leg.arrival_airport.value) if hasattr(leg.arrival_airport, 'value') else str(leg.arrival_airport),
                        "departure_time": str(leg.departure_datetime),
                        "arrival_time": str(leg.arrival_datetime),
                    })

                # Usar el primer leg para información básica
                first_leg = flight.legs[0] if flight.legs else None

                # Detectar moneda basada en el origen (aeropuertos mexicanos usan MXN)
                mexican_airports = ['GDL', 'MEX', 'CUN', 'MTY', 'TIJ', 'BJX', 'PVR', 'SJD', 'MZT', 'CUL',
                                   'HMO', 'CUU', 'QRO', 'AGU', 'ZCL', 'OAX', 'MID', 'VSA', 'VER',
                                   'TAP', 'CEN', 'CTM', 'ZIH', 'HUX', 'ACA', 'ZLO']

                detected_currency = "MXN" if origin.upper() in mexican_airports else "USD"

                # Verificar si la API devuelve currency, sino usar la detectada
                api_currency = str(flight.currency) if hasattr(flight, 'currency') else None
                final_currency = api_currency if api_currency and api_currency in ['USD', 'MXN', 'EUR'] else detected_currency

                flights.append({
                    "airline": str(first_leg.airline.value) if first_leg and hasattr(first_leg.airline, 'value') else "N/A",
                    "flight_number": str(first_leg.flight_number) if first_leg else "N/A",
                    "price": float(flight.price) if hasattr(flight, 'price') else 0,
                    "currency": final_currency,
                    "duration": f"{flight.duration} min" if hasattr(flight, 'duration') else "N/A",
                    "departure_time": str(first_leg.departure_datetime) if first_leg else "",
                    "arrival_time": str(first_leg.arrival_datetime) if first_leg else "",
                    "stops": int(flight.stops) if hasattr(flight, 'stops') else 0,
                    "origin": origin.upper(),
                    "destination": destination.upper(),
                    "legs": legs_data,
                    "booking_link": generate_google_flights_url(origin, destination, departure_date, return_date),
                })

        # Guardar en caché
        cache[cache_key] = flights

        print(f"✅ Encontrados {len(flights)} vuelos")

        return {
            "cached": False,
            "count": len(flights),
            "flights": flights
        }

    except Exception as e:
        print(f"❌ Error en búsqueda: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al buscar vuelos: {str(e)}"
        )


@app.get("/api/flights/dates")
async def search_dates_endpoint(
    origin: str = Query(..., description="Código IATA de origen"),
    destination: str = Query(..., description="Código IATA de destino"),
    start_date: str = Query(..., description="Inicio del rango (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Fin del rango (YYYY-MM-DD)"),
    trip_duration: int = Query(7, description="Duración del viaje en días"),
    is_round_trip: bool = Query(True, description="¿Ida y vuelta?"),
    cabin_class: str = Query("ECONOMY", description="Clase de cabina"),
):
    """
    Encuentra las fechas más baratas en un rango
    """
    if not FLI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="El servicio de búsqueda de fechas no está disponible"
        )

    # Generar clave de caché
    cache_params = {
        "type": "dates",
        "origin": origin,
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "trip_duration": trip_duration,
        "is_round_trip": is_round_trip,
        "cabin_class": cabin_class,
    }
    cache_key = get_cache_key(cache_params)

    # Verificar caché
    if cache_key in cache:
        return {
            "cached": True,
            "dates": cache[cache_key]
        }

    try:
        print(f"📅 Buscando fechas baratas {origin} → {destination}")

        # Parsear fechas
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")

        dates_results = []

        # Iterar sobre fechas en el rango
        current_date = start_dt
        while current_date <= end_dt:
            departure_str = current_date.strftime("%Y-%m-%d")
            return_str = None

            if is_round_trip:
                return_dt = current_date + timedelta(days=trip_duration)
                return_str = return_dt.strftime("%Y-%m-%d")

            # Crear segmentos
            segments = [
                FlightSegment(
                    departure_airport=[[parse_iata_to_airport(origin), 0]],
                    arrival_airport=[[parse_iata_to_airport(destination), 0]],
                    travel_date=departure_str,
                )
            ]

            trip_type = TripType.ONE_WAY
            if return_str:
                trip_type = TripType.ROUND_TRIP
                segments.append(
                    FlightSegment(
                        departure_airport=[[parse_iata_to_airport(destination), 0]],
                        arrival_airport=[[parse_iata_to_airport(origin), 0]],
                        travel_date=return_str,
                    )
                )

            # Buscar vuelos para esta fecha
            filters = FlightSearchFilters(
                passenger_info=PassengerInfo(adults=1),
                flight_segments=segments,
                seat_type=parse_cabin_class(cabin_class),
                sort_by=SortBy.CHEAPEST,
                trip_type=trip_type,
            )

            search = SearchFlights()
            results = search.search(filters)

            # Tomar el precio más bajo
            if results and len(results) > 0:
                cheapest = results[0]

                # Detectar moneda basada en el origen
                mexican_airports = ['GDL', 'MEX', 'CUN', 'MTY', 'TIJ', 'BJX', 'PVR', 'SJD', 'MZT', 'CUL',
                                   'HMO', 'CUU', 'QRO', 'AGU', 'ZCL', 'OAX', 'MID', 'VSA', 'VER',
                                   'TAP', 'CEN', 'CTM', 'ZIH', 'HUX', 'ACA', 'ZLO']
                detected_currency = "MXN" if origin.upper() in mexican_airports else "USD"
                api_currency = str(cheapest.currency) if hasattr(cheapest, 'currency') else None
                final_currency = api_currency if api_currency and api_currency in ['USD', 'MXN', 'EUR'] else detected_currency

                dates_results.append({
                    "departure_date": departure_str,
                    "return_date": return_str,
                    "price": float(cheapest.price) if hasattr(cheapest, 'price') else 0,
                    "currency": final_currency,
                })

            current_date += timedelta(days=1)

        # Ordenar por precio
        dates_results.sort(key=lambda x: x['price'])

        # Guardar en caché
        cache[cache_key] = dates_results

        print(f"✅ Encontradas {len(dates_results)} opciones de fechas")

        return {
            "cached": False,
            "count": len(dates_results),
            "dates": dates_results
        }

    except Exception as e:
        print(f"❌ Error en búsqueda de fechas: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al buscar fechas: {str(e)}"
        )


@app.post("/api/alerts")
async def create_alert(request: CreateAlertRequest):
    """
    Create a new price alert
    """
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=503,
            detail="Alert system not available. Configure Firebase first."
        )

    try:
        # Create alert document
        alert_data = {
            "userId": request.userId,
            "email": request.email,
            "origin": request.origin.upper(),
            "destination": request.destination.upper(),
            "targetPrice": request.targetPrice,
            "currency": request.currency,
            "active": True,
            "createdAt": datetime.now().isoformat(),
        }

        # Add to Firestore
        alert_ref = db.collection('alerts').add(alert_data)
        alert_id = alert_ref[1].id

        print(f"✅ Alert created: {alert_id} ({request.origin} → {request.destination})")

        return {
            "success": True,
            "alertId": alert_id,
            "alert": alert_data
        }

    except Exception as e:
        print(f"❌ Error creating alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/alerts")
async def list_alerts(userId: str = Query(..., description="User ID")):
    """
    List all alerts for a user
    """
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=503,
            detail="Alert system not available"
        )

    try:
        alerts_ref = db.collection('alerts')
        query = alerts_ref.where('userId', '==', userId).where('active', '==', True)
        alerts = query.stream()

        alert_list = []
        for alert_doc in alerts:
            alert_data = alert_doc.to_dict()
            alert_data['id'] = alert_doc.id
            alert_list.append(alert_data)

        return {
            "alerts": alert_list,
            "count": len(alert_list)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/alerts/{alertId}")
async def delete_alert(alertId: str):
    """
    Delete/deactivate an alert
    """
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=503,
            detail="Alert system not available"
        )

    try:
        alert_ref = db.collection('alerts').document(alertId)
        alert = alert_ref.get()

        if not alert.exists:
            raise HTTPException(status_code=404, detail="Alert not found")

        # Deactivate instead of delete
        alert_ref.update({'active': False})

        print(f"🗑️  Alert deactivated: {alertId}")

        return {"success": True, "message": "Alert deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/alerts/{alertId}/history")
async def get_price_history(
    alertId: str,
    days: int = Query(30, description="Number of days of history")
):
    """
    Get price history for an alert's route
    """
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=503,
            detail="Alert system not available"
        )

    try:
        # Get alert details
        alert_ref = db.collection('alerts').document(alertId)
        alert = alert_ref.get()

        if not alert.exists:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert_data = alert.to_dict()
        origin = alert_data['origin']
        destination = alert_data['destination']

        # Get price history
        history_ref = db.collection('priceHistory')

        # Query for this route in the last N days
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        today = datetime.now().strftime('%Y-%m-%d')

        history_list = []

        # Query documents that match this route
        query = history_ref.where('origin', '==', origin).where('destination', '==', destination)
        docs = query.stream()

        for doc in docs:
            data = doc.to_dict()
            if 'date' in data and start_date <= data['date'] <= today:
                history_list.append({
                    'date': data['date'],
                    'prices': data.get('prices', [])
                })

        # Sort by date
        history_list.sort(key=lambda x: x['date'])

        return {
            "origin": origin,
            "destination": destination,
            "targetPrice": alert_data['targetPrice'],
            "currency": alert_data['currency'],
            "history": history_list,
            "days": days
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    db = get_db()
    return {
        "status": "healthy",
        "cache_size": len(cache),
        "fli_available": FLI_AVAILABLE,
        "firebase_available": db is not None,
        "scheduler_running": scheduler.running if scheduler else False
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
