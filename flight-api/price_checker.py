"""
Price checker service - verifies flight prices and sends notifications
"""
from datetime import datetime, timedelta
from firebase_client import get_db
from email_service import send_price_alert_email
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


def parse_iata_to_airport(iata_code: str):
    """Convert IATA code to Airport enum"""
    try:
        return Airport[iata_code.upper()]
    except KeyError:
        return Airport(iata_code.upper())


def generate_google_flights_url(origin: str, destination: str, departure_date: str) -> str:
    """Generate Google Flights URL"""
    from urllib.parse import urlencode
    query = f"Flights from {origin.upper()} to {destination.upper()} on {departure_date}"
    params = {"q": query}
    return f"https://www.google.com/travel/flights?{urlencode(params)}"


async def check_alert_prices():
    """
    Check all active alerts and send notifications if price targets are met
    """
    db = get_db()
    if not db:
        print("⚠️  Firebase not initialized, skipping price check")
        return

    print(f"\n🔍 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking alert prices...")

    # Get all active alerts
    alerts_ref = db.collection('alerts')
    query = alerts_ref.where('active', '==', True)
    alerts = query.stream()

    checked_count = 0
    notified_count = 0

    for alert_doc in alerts:
        alert = alert_doc.to_dict()
        alert_id = alert_doc.id

        try:
            # Check if we should skip this alert (notified recently)
            last_notified = alert.get('lastNotified')
            if last_notified:
                # Don't notify more than once every 24 hours
                if isinstance(last_notified, str):
                    last_notified = datetime.fromisoformat(last_notified.replace('Z', '+00:00'))

                hours_since_notification = (datetime.now() - last_notified).total_seconds() / 3600
                if hours_since_notification < 24:
                    print(f"   ⏭️  Alert {alert_id[:8]}... notified {hours_since_notification:.1f}h ago, skipping")
                    continue

            # Search for the cheapest flight
            origin = alert['origin']
            destination = alert['destination']
            target_price = alert['targetPrice']
            currency = alert.get('currency', 'USD')
            user_email = alert['email']

            # Search for tomorrow's flights (most common use case)
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')

            print(f"   📊 Checking {origin} → {destination} (target: {currency} ${target_price})")

            # Create search filters
            segments = [
                FlightSegment(
                    departure_airport=[[parse_iata_to_airport(origin), 0]],
                    arrival_airport=[[parse_iata_to_airport(destination), 0]],
                    travel_date=tomorrow,
                )
            ]

            filters = FlightSearchFilters(
                passenger_info=PassengerInfo(adults=1),
                flight_segments=segments,
                seat_type=SeatType.ECONOMY,
                sort_by=SortBy.CHEAPEST,
                trip_type=TripType.ONE_WAY,
            )

            # Search flights
            search = SearchFlights()
            results = search.search(filters)

            if not results or len(results) == 0:
                print(f"   ⚠️  No flights found for {origin} → {destination}")
                continue

            # Get cheapest flight
            cheapest_flight = results[0]
            current_price = float(cheapest_flight.price) if hasattr(cheapest_flight, 'price') else 0

            # Update last checked timestamp
            alerts_ref.document(alert_id).update({
                'lastChecked': datetime.now().isoformat()
            })

            # Save price to history
            save_price_to_history(db, origin, destination, tomorrow, current_price, currency)

            checked_count += 1

            # Check if price is below target
            if current_price <= target_price:
                print(f"   ✅ Price target met! ${current_price} <= ${target_price}")

                # Generate booking link
                booking_link = generate_google_flights_url(origin, destination, tomorrow)

                # Send notification
                email_sent = send_price_alert_email(
                    to_email=user_email,
                    alert_id=alert_id,
                    origin=origin,
                    destination=destination,
                    current_price=current_price,
                    target_price=target_price,
                    currency=currency,
                    booking_link=booking_link
                )

                if email_sent:
                    # Update last notified timestamp
                    alerts_ref.document(alert_id).update({
                        'lastNotified': datetime.now().isoformat()
                    })
                    notified_count += 1
            else:
                print(f"   💰 Current price: ${current_price} (target: ${target_price})")

        except Exception as e:
            print(f"   ❌ Error checking alert {alert_id[:8]}...: {e}")
            continue

    print(f"✅ Price check complete: {checked_count} alerts checked, {notified_count} notifications sent\n")


def save_price_to_history(db, origin: str, destination: str, date: str, price: float, currency: str):
    """
    Save flight price to history for tracking
    """
    try:
        doc_id = f"{origin}-{destination}-{date}"
        history_ref = db.collection('priceHistory').document(doc_id)

        doc = history_ref.get()
        if doc.exists:
            # Append to existing prices array
            current_data = doc.to_dict()
            prices = current_data.get('prices', [])
            prices.append({
                'price': price,
                'currency': currency,
                'timestamp': datetime.now().isoformat(),
            })
            history_ref.update({'prices': prices})
        else:
            # Create new document
            history_ref.set({
                'origin': origin,
                'destination': destination,
                'date': date,
                'prices': [{
                    'price': price,
                    'currency': currency,
                    'timestamp': datetime.now().isoformat(),
                }]
            })
    except Exception as e:
        print(f"   ⚠️  Error saving price history: {e}")
