from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_ana_sayfa_calisiyor():
    response = client.get("/")
    assert response.status_code == 200


def test_health_check_basarili():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["model_yuklu"] is True


def test_gecerli_tahmin_istegi():
    response = client.post("/predict", json={
        "can_id_hex": "0000",
        "id_zaman_farki": 0.0005,
        "id_frekans_1sn": 500,
        "max_data_sapma": 0.1
    })
    assert response.status_code == 200
    assert "tahmin" in response.json()
    assert response.json()["tahmin"] in ["Normal", "DoS", "Fuzzy", "Gear", "RPM"]


def test_gecersiz_hex_reddedilir():
    response = client.post("/predict", json={
        "can_id_hex": "ZZZZ",
        "id_zaman_farki": 0.01,
        "id_frekans_1sn": 100,
        "max_data_sapma": 0.05
    })
    assert response.status_code == 422


def test_negatif_frekans_reddedilir():
    response = client.post("/predict", json={
        "can_id_hex": "0130",
        "id_zaman_farki": 0.01,
        "id_frekans_1sn": -50,
        "max_data_sapma": 0.05
    })
    assert response.status_code == 422


def test_eksik_alan_reddedilir():
    response = client.post("/predict", json={
        "can_id_hex": "0130"
    })
    assert response.status_code == 422