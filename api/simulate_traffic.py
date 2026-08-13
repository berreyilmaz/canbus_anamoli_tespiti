import requests
import time
import pandas as pd
import sys

API_URL = "http://localhost:5257/api"
KULLANICI_ADI = "test_user"
SIFRE = "sifre123"

def token_al():
    response = requests.post(f"{API_URL}/Auth/login", json={
        "kullaniciAdi": KULLANICI_ADI,
        "sifre": SIFRE
    })
    response.raise_for_status()
    return response.json()["token"]


def mesaj_gonder(token, can_id, id_zaman_farki, id_frekans_1sn, max_data_sapma):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "canIdHex": can_id,
        "idZamanFarki": id_zaman_farki,
        "idFrekans1sn": id_frekans_1sn,
        "maxDataSapma": max_data_sapma
    }
    response = requests.post(f"{API_URL}/CanBus/predict", json=payload, headers=headers)
    return response


def simulasyonu_calistir(dosya_yolu, hiz_carpani=0.3, limit=15):
    print(f"'{dosya_yolu}' dosyasından trafik simüle ediliyor...")

    token = token_al()
    print("Giriş başarılı, token alındı.\n")

    df = pd.read_csv(dosya_yolu)
    df = df.head(limit)

    for i, satir in df.iterrows():
        try:
            can_id_hex_str = format(int(satir["can_id_numerik"]), "04x")

            response = mesaj_gonder(
                token,
                can_id=can_id_hex_str,
                id_zaman_farki=satir["id_zaman_farki"],
                id_frekans_1sn=satir["id_frekans_1sn"],
                max_data_sapma=satir["max_data_sapma"]
            )

            if response.status_code == 200:
                sonuc = response.json()
                print(f"[{i+1}/{len(df)}] CAN ID: {satir['can_id_numerik']} → {sonuc['tahmin']}")
            else:
                print(f"[{i+1}/{len(df)}] Hata: {response.status_code} - {response.text}")

        except requests.exceptions.RequestException as e:
            print(f"Bağlantı hatası: {e}")
            break

        time.sleep(1 / hiz_carpani)

    print("\nSimülasyon tamamlandı.")


if __name__ == "__main__":
    dosya = sys.argv[1] if len(sys.argv) > 1 else "test_verisi.csv"
    simulasyonu_calistir(dosya)