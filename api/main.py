from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
import joblib
import numpy as np
import os
from google import genai
app = FastAPI(title="CAN Bus Anomali Tespit API")

model = joblib.load("model/canbus_model.pkl")
metadata = joblib.load("model/model_metadata.pkl")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
class CanMesaji(BaseModel):
    can_id_hex: str
    id_zaman_farki: float | None = None
    id_frekans_1sn: float
    max_data_sapma: float

    @field_validator("can_id_hex")
    @classmethod
    def hex_formatini_dogrula(cls, deger):
        try:
            int(deger, 16)
        except ValueError:
            raise ValueError(f"'{deger}' geçerli bir hex CAN ID değil (örnek: '0130', '0000')")
        return deger

    @field_validator("id_frekans_1sn", "max_data_sapma")
    @classmethod
    def negatif_olmasin(cls, deger):
        if deger < 0:
            raise ValueError("Bu değer negatif olamaz")
        return deger

    

@app.get("/")
def ana_sayfa():
    return {"mesaj": "CAN Bus Anomali Tespit API çalışıyor"}

@app.get("/health")
def saglik_kontrolu():
    return {"durum": "sağlıklı", "model_yuklu": model is not None}

@app.post("/predict")
def tahmin_et(mesaj: CanMesaji):
    try:
        can_id_numerik = int(mesaj.can_id_hex, 16)
        
        zaman_farki = mesaj.id_zaman_farki
        if zaman_farki is None:
            zaman_farki = metadata["id_zaman_farki_medyan_fallback"]
        
        X_yeni = np.array([[
            can_id_numerik,
            zaman_farki,
            mesaj.id_frekans_1sn,
            mesaj.max_data_sapma
        ]])
        
        tahmin = model.predict(X_yeni)[0]
        olasiliklar = model.predict_proba(X_yeni)[0]
        
        sinif_olasiliklari = dict(zip(model.classes_, olasiliklar.tolist()))
        
        return {
            "tahmin": tahmin,
            "olasiliklar": sinif_olasiliklari
        }
    
    except Exception as hata:
        raise HTTPException(
            status_code=500,
            detail=f"Tahmin sırasında beklenmedik bir hata oluştu: {str(hata)}"
        )

class TahminOzeti(BaseModel):
    can_id_hex: str
    tahmin: str
    olasilik: float
    zaman: str


class RaporIstegi(BaseModel):
    tahminler: list[TahminOzeti]


@app.post("/report")
async def rapor_olustur(istek: RaporIstegi):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI raporu için API anahtarı yapılandırılmamış")

    if len(istek.tahminler) == 0:
        raise HTTPException(status_code=400, detail="Rapor için en az bir tahmin gerekli")

    ozet_metni = "\n".join([
        f"- {t.zaman}: CAN ID {t.can_id_hex} → {t.tahmin} (%{t.olasilik*100:.0f} olasılık)"
        for t in istek.tahminler
    ])

    saldiri_sayisi = sum(1 for t in istek.tahminler if t.tahmin != "Normal")

    prompt = f"""Sen bir araç siber güvenliği uzmanısın. Aşağıda bir CAN bus anomali tespit sisteminin son tahmin kayıtları var. Bunları analiz edip, kısa (en fazla 150 kelime), Türkçe, profesyonel bir güvenlik özeti yaz. Toplam {len(istek.tahminler)} kayıttan {saldiri_sayisi} tanesi saldırı olarak işaretlenmiş.

Kayıtlar:
{ozet_metni}

Özet şunları içersin: genel durum değerlendirmesi, en dikkat çekici bulgu, ve önerilen bir aksiyon. Teknik ama anlaşılır bir dil kullan."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        response = gemini_client.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt
        )
        rapor_metni = response.text

        return {"rapor": rapor_metni}

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI servisi hatası: {str(e)}")