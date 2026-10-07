# 🎧 DJ Voice Bot — Discord Music & Voice Recognition Bot

Un bot de música para Discord de última generación con **reconocimiento de comandos de voz en español en tiempo real** utilizando **Faster-Whisper** localmente (sin costos de API externas), reproducción de audio de alta fidelidad vía **FFmpeg** y **yt-dlp**, y un reproductor interactivo con botones integrados en Discord.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Faster--Whisper](https://img.shields.io/badge/Faster--Whisper-Local_AI-FF6F00)](https://github.com/SYSTRAN/faster-whisper)

---

## 🌟 Características Principales

- 🎙️ **Control por Voz en Español:** Di la palabra clave `"DJ"` (o variantes fonéticas como *"oye DJ"*, *"dejei"*) seguida de tu orden en lenguaje natural.
- ⚡ **Transcripción Local Ultrarrápida:** Microservicio Python en segundo plano con `faster-whisper` (cuantización int8 para CPU), sin enviar audios a servicios de pago en la nube.
- 🎵 **Reproducción Musical de Alta Calidad:** Extracción de stream mediante `yt-dlp` y decodificación PCM estéreo 48 kHz con `ffmpeg` conectado directamente a la conexión de voz de Discord.
- 🎛️ **Interfaz Interactiva en Discord:** Embed dinámico en el canal de texto con información de la pista actual, tiempo, estado de la cola y botones interactivos (Play/Pausa, Skip, Stop, Vol +, Vol -).
- 📜 **Sistema de Cola de Reproducción:** Agrega múltiples canciones y continúa reproduciendo automáticamente al terminar la pista.
- 🛡️ **Tolerancia Fonética Robusta:** Normalización de tildes, signos de puntuación y errores fonéticos comunes de transcripción en español.
- 🚀 **Lanzador Unificado:** Script inteligente (`scripts/start.js` / `./start.sh`) que levanta el microservicio Whisper, verifica su estado de salud (`/health`) e inicia el bot de Discord de forma coordinada.

---

## 🏛️ Arquitectura del Sistema

```
                  ┌──────────────────────────────────────────────┐
                  │                 Canal de Voz                 │
                  └───────┬──────────────────────────────▲───────┘
                          │ (Audio de usuario)           │ (Música PCM 48kHz)
                          ▼                              │
             ┌─────────────────────────┐     ┌───────────┴─────────────┐
             │    Audio Receiver       │     │      Music Player       │
             │   (Discord.js Voice)    │     │   (FFmpeg + yt-dlp)     │
             └────────────┬────────────┘     └───────────▲─────────────┘
                          │ (WAV 16kHz)                  │
                          ▼                              │ (Ejecuta acción)
             ┌─────────────────────────┐                 │
             │ Faster-Whisper Server   │                 │
             │  (Python Flask :8787)   │                 │
             └────────────┬────────────┘                 │
                          │ (Texto transcrito)           │
                          ▼                              │
             ┌───────────────────────────────────────────┴─────────────┐
             │    Wake Word Detection ("DJ") & Command Parser          │
             └─────────────────────────────────────────────────────────┘
```

---

## 📋 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes en tu sistema:

1. **Node.js**: Versión `18.0.0` o superior ([Descargar Node.js](https://nodejs.org/)).
2. **Python**: Versión `3.10` o superior ([Descargar Python](https://www.python.org/)).
3. **FFmpeg**: Necesario para el procesamiento y transmisión de audio.
   - **macOS** (Homebrew): `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt update && sudo apt install -y ffmpeg`
   - **Windows**: `winget install Gyan.FFmpeg` o descargar de [ffmpeg.org](https://ffmpeg.org/).
4. **yt-dlp**: Motor de extracción de audio.
   - **macOS** (Homebrew): `brew install yt-dlp`
   - **Pip**: `pip install -U yt-dlp`

---

## ⚙️ Instalación y Configuración

### 1. Clonar el Repositorio
```bash
git clone git@github.com:juliotrelles98/AFK-DISCORD-BOT.git
cd AFK-DISCORD-BOT
```

### 2. Instalar Dependencias de Node.js
```bash
npm install
```

### 3. Instalar Dependencias de Python
```bash
pip install -r python/requirements.txt
```
> **Nota:** Se recomienda usar un entorno virtual de Python (`python3 -m venv .venv && source .venv/bin/activate`) o el Python global del sistema.

### 4. Configurar Variables de Entorno
Copia la plantilla de entorno:
```bash
cp .env.example .env
```
Edita `.env` con tus credenciales:
```env
# Discord Bot Credentials
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id_aqui

# Whisper Microservice Configuration
WHISPER_URL=http://localhost:8787
WHISPER_MODEL=base
```

> **Modelos de Whisper disponibles:** `tiny` (más rápido), `base` (recomendado para balance velocidad/precisión), `small` (mayor precisión).

### 5. Configurar Permisos en Discord Developer Portal
En el panel de tu aplicación en [Discord Developer Portal](https://discord.com/developers/applications):
1. Ve a la sección **Bot** y habilita los siguientes **Privileged Gateway Intents**:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent**
2. En **OAuth2 -> URL Generator**, selecciona los scopes:
   - `bot`
   - `applications.commands`
3. En **Bot Permissions**, concede:
   - `Connect`
   - `Speak`
   - `Use Voice Activity`
   - `Send Messages`
   - `Embed Links`
   - `View Channels`
4. Usa la URL generada para invitar el bot a tu servidor.

---

## 🚀 Despliegue y Ejecución

### 1. Registrar Comandos Slash
Antes del primer inicio o si modificas los comandos, regístralos en Discord:
```bash
npm run deploy-commands
```

### 2. Iniciar el Bot (Modo Completo)
Para iniciar automáticamente tanto el servidor Faster-Whisper como el bot de Discord en un solo comando:
```bash
npm start
# o también:
./start.sh
```

El script verificará el estado de salud del servidor Whisper en `http://127.0.0.1:8787/health` antes de arrancar el cliente de Discord.

### 3. Iniciar Servicios por Separado (Opcional)
Si prefieres tener terminales independientes:
- **Terminal 1 (Whisper Server):**
  ```bash
  npm run start:whisper
  ```
- **Terminal 2 (Discord Bot):**
  ```bash
  npm run start:bot
  ```

---

## 🗣️ Guía de Comandos

### Comandos Slash (Chat)
| Comando | Descripción |
| :--- | :--- |
| `/join` | Conecta el bot a tu canal de voz actual y activa la escucha de voz. |
| `/leave` | Desconecta al bot del canal de voz y detiene la reproducción. |

---

### Comandos de Voz en Español

Para activar el bot, empieza siempre tu frase con la palabra clave **`DJ`** (o *"oye DJ"*):

#### 🎵 Reproducción Musical
- *"DJ ponme la canción de [canción/artista]"*
- *"DJ pon [canción o enlace]"*
- *"DJ reproduce [canción]"*
- *"DJ toca [canción/artista]"*
- *"DJ quiero escuchar a [artista]"*

#### ⏯️ Control de Reproducción
- *"DJ pausa"* / *"DJ pausa la música"*
- *"DJ dale play"* / *"DJ reanuda"* / *"DJ continúa la canción"*
- *"DJ pasa la canción"* / *"DJ siguiente"* / *"DJ salta"* / *"DJ cambia de música"*
- *"DJ para la música"* / *"DJ detén la música"* / *"DJ apaga"*

#### 🔊 Control de Volumen
- *"DJ sube el volumen"* / *"DJ súbele"* / *"DJ más volumen"*
- *"DJ baja el volumen"* / *"DJ bájale"* / *"DJ menos volumen"*

---

## 🎛️ Controles Interactivos en Pantalla

Cada vez que se reproduce una pista, el bot envía y actualiza un panel en el canal de texto con los siguientes botones:

| Botón | Acción |
| :---: | :--- |
| ⏯️ | Alternar entre Pausa y Reanudar |
| ⏭️ | Saltar a la siguiente canción de la cola |
| ⏹️ | Detener la reproducción y limpiar la cola |
| 🔉 | Bajar el volumen en un 10% |
| 🔊 | Subir el volumen en un 10% |

---

## 📁 Estructura del Proyecto

```text
├── .env.example              # Plantilla de variables de entorno
├── Procfile                  # Definición de procesos para despliegues
├── package.json              # Dependencias y scripts de Node.js
├── tsconfig.json             # Configuración del compilador TypeScript
├── start.sh                  # Script rápido de ejecución en shell
├── python/
│   ├── requirements.txt      # Dependencias de Python (faster-whisper, flask)
│   ├── start_whisper.sh      # Script de arranque del servicio Whisper
│   └── whisper_server.py     # Microservicio HTTP de transcripción de audio
├── scripts/
│   └── start.js              # Coordinador de arranque dual con health check
└── src/
    ├── config.ts             # Carga y validación de variables de entorno
    ├── deploy-commands.ts    # Registro de slash commands en la API de Discord
    ├── index.ts              # Punto de entrada principal del bot
    ├── commands/
    │   ├── parser.ts         # Intérprete y normalizador de comandos de voz
    │   └── parser.test.ts    # Pruebas unitarias del parser
    ├── discord/
    │   ├── client.ts         # Inicialización de Discord.js y handlers
    │   ├── receiver.ts       # Captura de paquetes Opus en tiempo real
    │   └── voice.ts          # Gestión de conexiones de voz (@discordjs/voice)
    ├── music/
    │   ├── player.ts         # Reproductor musical (FFmpeg + yt-dlp + UI Embed)
    │   ├── queue.ts          # Estructura de cola de pistas
    │   └── search.ts         # Búsqueda de pistas y metadatos
    └── speech/
        ├── audioConverter.ts # Conversión y acondicionamiento PCM/WAV
        ├── wakeWord.ts       # Detección y tolerancia fonética de la palabra clave
        └── whisper.ts        # Cliente HTTP hacia el microservicio Whisper
```

---

## 🧪 Pruebas del Parser de Comandos

Para comprobar cómo el parser interpreta diferentes variantes de voz en español:
```bash
npm run test:parser
```

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia MIT. Consulta el código fuente para más detalles.
