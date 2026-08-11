import axios from "axios";

const API_BASE_URL = "http://localhost:5257/api";

let authToken = null;

export function setToken(token) {
  authToken = token;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export async function login(kullaniciAdi, sifre) {
  const response = await apiClient.post("/Auth/login", {
    kullaniciAdi,
    sifre,
  });
  return response.data.token;
}

export async function register(kullaniciAdi, sifre) {
  const response = await apiClient.post("/Auth/register", {
    kullaniciAdi,
    sifre,
  });
  return response.data;
}

export async function predict(canMesaji) {
  try {
    const response = await apiClient.post("/CanBus/predict", canMesaji);
    return response.data;
  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error("Çok fazla istek gönderdiniz, lütfen biraz bekleyip tekrar deneyin");
    }
    throw new Error("Tahmin sırasında bir hata oluştu");
  }
}

export async function getHistory() {
  const response = await apiClient.get("/CanBus/history");
  return response.data;
}