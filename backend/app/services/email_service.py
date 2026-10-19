"""
Servicio de correos electrónicos (Fase 4).

Envía las notificaciones del sistema con plantillas HTML institucionales:
    1. Confirmación al aspirante cuando radica su solicitud.
    2. Aviso al BackOffice (EMAIL_ADMIN) de una nueva solicitud.
    3. Solicitud aprobada.
    4. Solicitud rechazada (con la justificación).
    5. Recuperación de contraseña (con el enlace).

Proveedor (se elige solo según el .env, ver settings.py):
    RESEND_API_KEY -> Resend  |  SMTP_HOST -> SMTP  |  ninguno -> solo se escribe en la consola.

Las funciones notificar_* se pasan a BackgroundTasks de FastAPI: corren DESPUÉS
de enviar la respuesta, así que nunca demoran al usuario. Por eso reciben solo
textos (no objetos de la base de datos, cuya sesión ya está cerrada) y nunca
lanzan excepciones: si el envío falla, solo se registra en el log.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from html import escape

from app.config.settings import settings

logger = logging.getLogger("casacultura.email")

# Colores institucionales (los mismos de la paleta de Tailwind del frontend).
_PIZARRA_950 = "#0c1528"
_PIZARRA_600 = "#435473"
_PRADERA_600 = "#376a52"
_ROSE_600 = "#e11d48"
_SLATE_50 = "#f8fafc"
_SLATE_200 = "#e2e8f0"
_SLATE_500 = "#64748b"


# --------------------------------------------------------------------------- #
# Envío
# --------------------------------------------------------------------------- #
def _enviar_con_resend(destinatario: str, asunto: str, html: str) -> None:
    """Envía el correo con la API de Resend."""
    import resend  # Se importa aquí para que la API arranque aunque la librería no esté instalada.

    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({"from": settings.EMAIL_FROM, "to": [destinatario], "subject": asunto, "html": html})


def _enviar_con_smtp(destinatario: str, asunto: str, html: str) -> None:
    """Envía el correo por SMTP (SSL en el puerto 465 o STARTTLS en el 587)."""
    nombre, direccion = parseaddr(settings.EMAIL_FROM)
    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = formataddr((nombre, direccion or settings.SMTP_USER))
    mensaje["To"] = destinatario
    mensaje.set_content("Este mensaje requiere un cliente de correo compatible con HTML.")
    mensaje.add_alternative(html, subtype="html")

    contexto = ssl.create_default_context()
    if settings.SMTP_USE_SSL:
        servidor = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=contexto, timeout=20)
    else:
        servidor = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    with servidor:
        if not settings.SMTP_USE_SSL:
            servidor.starttls(context=contexto)
        if settings.SMTP_USER:
            servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        servidor.send_message(mensaje)


def enviar_correo(destinatario: str, asunto: str, html: str) -> bool:
    """Envía un correo con el proveedor configurado.

    Returns:
        True si se envió (o se escribió en consola en modo desarrollo); False si falló.
        Nunca lanza excepciones, para no romper la tarea en segundo plano.
    """
    if not destinatario:
        logger.warning("Correo '%s' no enviado: no hay destinatario.", asunto)
        return False
    try:
        if settings.RESEND_API_KEY:
            _enviar_con_resend(destinatario, asunto, html)
        elif settings.SMTP_HOST:
            _enviar_con_smtp(destinatario, asunto, html)
        elif settings.is_production:
            # En producción no se escribe el contenido en el log (puede llevar el enlace de recuperación).
            logger.error("Correo '%s' no enviado a %s: no hay proveedor configurado.", asunto, destinatario)
            return False
        else:
            # Modo desarrollo: sin proveedor configurado, el correo se muestra en la consola.
            logger.info("[CORREO SIMULADO] Para: %s | Asunto: %s\n%s", destinatario, asunto, html)
            return True
        logger.info("Correo enviado a %s: %s", destinatario, asunto)
        return True
    except Exception:  # noqa: BLE001 - cualquier fallo del proveedor solo se registra.
        logger.exception("No fue posible enviar el correo '%s' a %s.", asunto, destinatario)
        return False


# --------------------------------------------------------------------------- #
# Plantillas HTML
# --------------------------------------------------------------------------- #
# Los correos usan tablas y estilos en línea porque los clientes de correo
# (Gmail, Outlook) no aceptan hojas de estilo ni diseño moderno.
def _plantilla(titulo: str, contenido: str, color: str = _PIZARRA_950) -> str:
    """Marco común: encabezado institucional, título, contenido y pie de página."""
    return f"""<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:{_SLATE_50};font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_SLATE_50};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid {_SLATE_200};border-radius:12px;overflow:hidden;">
        <tr><td style="background:{_PIZARRA_950};padding:20px 28px;">
          <p style="margin:0;font-size:16px;font-weight:bold;color:#ffffff;">Casa de la Cultura</p>
          <p style="margin:2px 0 0;font-size:13px;color:#aab7cc;">San Pedro de los Milagros</p>
        </td></tr>
        <tr><td style="height:4px;background:{color};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:{_PIZARRA_950};">{titulo}</h1>
          {contenido}
        </td></tr>
        <tr><td style="padding:16px 28px;background:{_SLATE_50};border-top:1px solid {_SLATE_200};font-size:12px;color:{_SLATE_500};">
          Este es un mensaje automático, por favor no responda a este correo.<br>
          Casa de la Cultura &middot; Municipio de San Pedro de los Milagros, Antioquia.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _parrafo(texto: str) -> str:
    """Párrafo con el estilo de los correos (el texto ya debe venir escapado)."""
    return f'<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">{texto}</p>'


def _radicado(numero: str) -> str:
    """Número de radicado destacado en un recuadro."""
    return (
        f'<p style="margin:0 0 18px;padding:12px 16px;background:{_SLATE_50};border:1px solid {_SLATE_200};'
        f'border-radius:8px;font-size:13px;color:{_SLATE_500};">Número de radicado<br>'
        f'<strong style="font-size:20px;color:{_PIZARRA_950};letter-spacing:1px;">{escape(numero)}</strong></p>'
    )


def plantilla_confirmacion_aspirante(nombre: str, radicado: str, programa: str) -> tuple[str, str]:
    """Correo 1: el aspirante radicó su solicitud. Devuelve (asunto, html)."""
    contenido = (
        _parrafo(f"Hola, <strong>{escape(nombre)}</strong>.")
        + _parrafo(
            f"Tu solicitud <strong>{escape(radicado)}</strong> ha sido recibida para el programa "
            f"<strong>{escape(programa)}</strong>."
        )
        + _radicado(radicado)
        + _parrafo("Mantente atento a este correo para el estado de tu proceso.")
    )
    return f"Solicitud recibida: {radicado}", _plantilla("Solicitud recibida", contenido, _PIZARRA_600)


def plantilla_aviso_backoffice(nombre: str, radicado: str, programa: str) -> tuple[str, str]:
    """Correo 2: aviso al BackOffice de una nueva solicitud. Devuelve (asunto, html)."""
    enlace = f"{settings.FRONTEND_URL}/dashboard/solicitudes"
    contenido = (
        _parrafo(f"Nueva solicitud de inscripción registrada: <strong>{escape(radicado)}</strong>.")
        + _parrafo(f"Aspirante: <strong>{escape(nombre)}</strong><br>Programa: <strong>{escape(programa)}</strong>")
        + _boton("Revisar solicitudes", enlace, _PIZARRA_950)
    )
    return f"Nueva solicitud de inscripción: {radicado}", _plantilla("Nueva solicitud", contenido, _PIZARRA_600)


def plantilla_solicitud_aprobada(nombre: str, radicado: str, programa: str) -> tuple[str, str]:
    """Correo 3: la solicitud fue aprobada. Devuelve (asunto, html)."""
    contenido = (
        _parrafo(f"Hola, <strong>{escape(nombre)}</strong>.")
        + _parrafo(
            f"Felicidades, tu solicitud <strong>{escape(radicado)}</strong> ha sido "
            f'<strong style="color:{_PRADERA_600};">aprobada</strong>.'
        )
        + _parrafo(f"Bienvenido al programa <strong>{escape(programa)}</strong>.")
    )
    return f"Solicitud aprobada: {radicado}", _plantilla("¡Solicitud aprobada!", contenido, _PRADERA_600)


def plantilla_solicitud_rechazada(nombre: str, radicado: str, justificacion: str) -> tuple[str, str]:
    """Correo 4: la solicitud fue rechazada, con el motivo. Devuelve (asunto, html)."""
    # El motivo lo escribe un funcionario: se escapa y se respetan sus saltos de línea.
    motivo = escape(justificacion).replace("\n", "<br>")
    contenido = (
        _parrafo(f"Hola, <strong>{escape(nombre)}</strong>.")
        + _parrafo(
            f"Tu solicitud <strong>{escape(radicado)}</strong> ha sido "
            f'<strong style="color:{_ROSE_600};">rechazada</strong>.'
        )
        + (
            f'<p style="margin:0 0 18px;padding:12px 16px;background:#fff1f2;border-left:4px solid {_ROSE_600};'
            f'border-radius:4px;font-size:15px;line-height:1.6;"><strong>Motivo:</strong><br>{motivo}</p>'
        )
        + _parrafo("Por favor, realiza las correcciones y presenta una nueva solicitud.")
    )
    return f"Solicitud rechazada: {radicado}", _plantilla("Solicitud rechazada", contenido, _ROSE_600)


def plantilla_recuperacion_password(nombre: str, enlace: str) -> tuple[str, str]:
    """Correo 5: enlace para restablecer la contraseña. Devuelve (asunto, html)."""
    minutos = settings.PASSWORD_RESET_EXPIRE_MINUTES
    contenido = (
        _parrafo(f"Hola, <strong>{escape(nombre)}</strong>.")
        + _parrafo("Has solicitado restablecer tu contraseña. Haz clic aquí:")
        + _boton("Restablecer contraseña", enlace, _PIZARRA_950)
        + _parrafo(f"El enlace vence en <strong>{minutos} minutos</strong> y solo se puede usar una vez.")
        + f'<p style="margin:0 0 14px;font-size:12px;color:{_SLATE_500};word-break:break-all;">'
        f"Si el botón no funciona, copie esta dirección en el navegador:<br>{escape(enlace)}</p>"
        + _parrafo("Si no solicitaste este cambio, ignora este mensaje: tu contraseña no cambiará.")
    )
    return "Recuperación de contraseña", _plantilla("Recuperación de contraseña", contenido)


def _boton(texto: str, enlace: str, color: str) -> str:
    """Botón con enlace (compatible con clientes de correo)."""
    return (
        f'<p style="margin:8px 0 22px;"><a href="{escape(enlace, quote=True)}" '
        f'style="display:inline-block;padding:12px 22px;background:{color};color:#ffffff;'
        f'text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;">{escape(texto)}</a></p>'
    )


# --------------------------------------------------------------------------- #
# Tareas para BackgroundTasks (una por evento)
# --------------------------------------------------------------------------- #
def notificar_solicitud_radicada(correo: str, nombre: str, radicado: str, programa: str) -> None:
    """Nueva solicitud: confirmación al aspirante y aviso al BackOffice."""
    enviar_correo(correo, *plantilla_confirmacion_aspirante(nombre, radicado, programa))
    if settings.EMAIL_ADMIN:
        enviar_correo(settings.EMAIL_ADMIN, *plantilla_aviso_backoffice(nombre, radicado, programa))
    else:
        logger.warning("EMAIL_ADMIN no está configurado: no se envió el aviso de %s al BackOffice.", radicado)


def notificar_solicitud_evaluada(
    correo: str, nombre: str, radicado: str, programa: str, estado: str, justificacion: str
) -> None:
    """Solicitud evaluada: correo de aprobación o de rechazo según el estado."""
    if estado == "APROBADO":
        enviar_correo(correo, *plantilla_solicitud_aprobada(nombre, radicado, programa))
    elif estado == "RECHAZADO":
        enviar_correo(correo, *plantilla_solicitud_rechazada(nombre, radicado, justificacion))


def notificar_recuperacion_password(correo: str, nombre: str, enlace: str) -> None:
    """Recuperación de contraseña: envía el enlace al correo registrado del usuario."""
    enviar_correo(correo, *plantilla_recuperacion_password(nombre, enlace))
