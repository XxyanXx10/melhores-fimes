"""
Rastreia uma pessoa num vídeo de câmera parada: pontos do corpo, ponta dos dedos e
recorte (máscara) quadro a quadro. É a base para pôr efeitos ATRÁS da pessoa e
nas mãos dela.

    venv/Scripts/python.exe vfx/rastrear.py <video.mp4> <pasta_saida>

Saída: <pasta>/rastreio.json (por quadro: pulsos, dedos indicadores, ombros, em pixels)
       <pasta>/mascaras/00001.png (0 = fundo, 255 = pessoa, borda suavizada)
Modelos MediaPipe em C:/Users/yaned/Videos/Melhores Fimes/vfx/modelos.
"""
import json, os, sys
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/vfx/modelos'
video, saida = sys.argv[1], sys.argv[2]
os.makedirs(f'{saida}/mascaras', exist_ok=True)

pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=mpp.BaseOptions(model_asset_path=f'{MODELOS}/pose_landmarker_heavy.task'),
    running_mode=vision.RunningMode.VIDEO, output_segmentation_masks=True,
    min_pose_detection_confidence=0.4, min_tracking_confidence=0.4))
maos = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
    base_options=mpp.BaseOptions(model_asset_path=f'{MODELOS}/hand_landmarker.task'),
    running_mode=vision.RunningMode.VIDEO, num_hands=2, min_hand_detection_confidence=0.3))
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=mpp.BaseOptions(model_asset_path=f'{MODELOS}/selfie_multiclass_256x256.tflite'),
    running_mode=vision.RunningMode.VIDEO, output_category_mask=True))

cap = cv2.VideoCapture(video)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
PONTOS = {'ombro_e': 11, 'ombro_d': 12, 'cotovelo_e': 13, 'cotovelo_d': 14, 'pulso_e': 15, 'pulso_d': 16,
          'indicador_e': 19, 'indicador_d': 20, 'nariz': 0, 'quadril_e': 23, 'quadril_d': 24}
quadros = []
i = 0
while True:
    ok, bgr = cap.read()
    if not ok:
        break
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    t = int(i * 1000 / fps)
    rp = pose.detect_for_video(img, t)
    rh = maos.detect_for_video(img, t)
    rs = seg.segment_for_video(img, t)
    q = {'q': i}
    masc = np.zeros((h, w), np.float32)
    if rp.pose_landmarks:
        lm = rp.pose_landmarks[0]
        for nome, k in PONTOS.items():
            q[nome] = [round(lm[k].x * w, 1), round(lm[k].y * h, 1), round(lm[k].visibility, 2)]
        if rp.segmentation_masks:
            masc = np.maximum(masc, rp.segmentation_masks[0].numpy_view().astype(np.float32).reshape(h, w))
    if rs.category_mask is not None:
        cat = rs.category_mask.numpy_view().reshape(h, w)
        masc = np.maximum(masc, (cat > 0).astype(np.float32))
    if rh.hand_landmarks:
        q['maos'] = [[round(m[8].x * w, 1), round(m[8].y * h, 1)] for m in rh.hand_landmarks]  # ponta do indicador
    # borda macia: fecha buracos pequenos e suaviza
    masc = cv2.morphologyEx(masc, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    masc = cv2.GaussianBlur(masc, (0, 0), 2.0)
    cv2.imwrite(f'{saida}/mascaras/{i + 1:05d}.png', np.clip(masc * 255, 0, 255).astype(np.uint8))
    quadros.append(q)
    i += 1
    if i % 100 == 0:
        print('quadro', i, flush=True)

json.dump({'fps': fps, 'largura': w, 'altura': h, 'quadros': quadros}, open(f'{saida}/rastreio.json', 'w'))
print('ok', i, 'quadros')
