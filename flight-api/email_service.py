"""
Email notification service using Resend
"""
import os
from typing import Optional
import resend
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def send_price_alert_email(
    to_email: str,
    alert_id: str,
    origin: str,
    destination: str,
    current_price: float,
    target_price: float,
    currency: str,
    booking_link: str
) -> bool:
    """
    Send price alert notification email
    """
    if not resend.api_key:
        print("⚠️  Resend API key not configured. Email not sent.")
        return False

    subject = f"🎉 ¡Alerta de Precio! {origin} → {destination}"

    savings = target_price - current_price
    savings_percent = (savings / target_price) * 100

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                       color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .price-box {{ background: white; padding: 20px; border-radius: 8px;
                         margin: 20px 0; border-left: 4px solid #667eea; }}
            .price {{ font-size: 36px; font-weight: bold; color: #667eea; }}
            .savings {{ color: #10b981; font-weight: bold; }}
            .button {{ display: inline-block; background: #667eea; color: white;
                      padding: 12px 30px; text-decoration: none; border-radius: 6px;
                      margin: 20px 0; font-weight: bold; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✈️ ¡Tu Precio Objetivo Alcanzado!</h1>
            </div>
            <div class="content">
                <h2>Vuelo: {origin} → {destination}</h2>

                <div class="price-box">
                    <p>Precio actual:</p>
                    <div class="price">{currency} ${current_price:,.2f}</div>
                    <p class="savings">
                        ¡Ahorras {currency} ${savings:,.2f} ({savings_percent:.1f}% menos)!
                    </p>
                    <p style="color: #666; margin-top: 10px;">
                        Tu precio objetivo era: {currency} ${target_price:,.2f}
                    </p>
                </div>

                <p>Este es el momento perfecto para reservar tu vuelo. Los precios pueden cambiar rápidamente.</p>

                <div style="text-align: center;">
                    <a href="{booking_link}" class="button">
                        Ver Vuelo en Google Flights
                    </a>
                </div>

                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
                    💡 <strong>Consejo:</strong> Los precios de vuelos pueden cambiar en minutos.
                    Te recomendamos revisar lo antes posible.
                </p>

                <div class="footer">
                    <p>Este email fue enviado porque creaste una alerta de precio en GusTrips.</p>
                    <p>
                        <a href="{FRONTEND_URL}/alerts">Gestionar mis alertas</a>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        params = {
            "from": "GusTrips <alerts@gustrips.com>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }

        email = resend.Emails.send(params)
        print(f"✅ Email sent to {to_email} (Alert ID: {alert_id})")
        return True

    except Exception as e:
        print(f"❌ Error sending email: {e}")
        return False


def send_test_email(to_email: str) -> bool:
    """Send a test email to verify configuration"""
    if not resend.api_key:
        return False

    try:
        params = {
            "from": "GusTrips <alerts@gustrips.com>",
            "to": [to_email],
            "subject": "🎉 Resend configurado correctamente",
            "html": "<h1>¡Funciona!</h1><p>Las notificaciones de GusTrips están listas.</p>",
        }
        resend.Emails.send(params)
        return True
    except Exception as e:
        print(f"Error sending test email: {e}")
        return False
