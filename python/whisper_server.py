#!/usr/bin/env python3
"""Faster-Whisper transcription server for DJ Voice Bot."""

import io
import os
import sys
import time
import logging
from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [WHISPER] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global model reference
model = None

def load_model():
    """Load the faster-whisper model."""
    global model
    model_size = os.environ.get('WHISPER_MODEL', 'base')
    
    logger.info(f'Loading faster-whisper model: {model_size}')
    start = time.time()
    
    from faster_whisper import WhisperModel
    
    # Use CPU with int8 quantization for best local performance
    model = WhisperModel(
        model_size,
        device='cpu',
        compute_type='int8'
    )
    
    elapsed = time.time() - start
    logger.info(f'Model loaded in {elapsed:.1f}s')


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None
    })


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Transcribe audio from request body.
    
    Expects raw WAV audio in the request body.
    Returns JSON with transcription text.
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 503
    
    if not request.data:
        return jsonify({'error': 'No audio data received'}), 400
    
    try:
        audio_data = io.BytesIO(request.data)
        
        start = time.time()
        
        segments, info = model.transcribe(
            audio_data,
            language='es',
            beam_size=5,
            initial_prompt="DJ, pon, reproduce, pausa, siguiente, continúa, para, stop, volumen, Bad Bunny, Maná, The Weeknd.",
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=400,
                speech_pad_ms=300,
            ),
        )
        
        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())
        
        full_text = ' '.join(text_parts).strip()
        elapsed = time.time() - start
        
        logger.info(f'Transcribed in {elapsed:.2f}s: "{full_text}"')
        
        return jsonify({
            'text': full_text,
            'language': info.language,
            'language_probability': round(info.language_probability, 3),
            'duration': round(elapsed, 3)
        })
        
    except Exception as e:
        logger.error(f'Transcription error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('WHISPER_PORT', '8787'))
    
    logger.info('Starting Whisper transcription server...')
    load_model()
    
    logger.info(f'Server listening on http://localhost:{port}')
    app.run(
        host='127.0.0.1',
        port=port,
        debug=False,
        threaded=True
    )
