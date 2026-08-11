using CanBusApi.Models;

namespace CanBusApi.Services;

public class CanBusPredictionService
{
    private readonly HttpClient _httpClient;

    public CanBusPredictionService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<TahminResponse> TahminYapAsync(CanMesajiRequest istek)
    {
        var fastApiIstegi = new FastApiIstek
        {
            CanIdHex = istek.CanIdHex,
            IdZamanFarki = istek.IdZamanFarki,
            IdFrekans1sn = istek.IdFrekans1sn,
            MaxDataSapma = istek.MaxDataSapma
        };

        var response = await _httpClient.PostAsJsonAsync("/predict", fastApiIstegi);

        if (!response.IsSuccessStatusCode)
        {
            var hataDetayi = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Model servisi hata döndü: {hataDetayi}");
        }

        var sonuc = await response.Content.ReadFromJsonAsync<TahminResponse>();

        if (sonuc is null)
        {
            throw new InvalidOperationException("Model servisinden boş yanıt geldi.");
        }

        return sonuc;
    }
}