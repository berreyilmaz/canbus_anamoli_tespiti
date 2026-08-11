using System.Text.Json.Serialization;

namespace CanBusApi.Models;

public class CanMesajiRequest
{
    public string CanIdHex { get; set; } = string.Empty;
    public double? IdZamanFarki { get; set; }
    public double IdFrekans1sn { get; set; }
    public double MaxDataSapma { get; set; }
}

public class FastApiIstek
{
    [JsonPropertyName("can_id_hex")]
    public string CanIdHex { get; set; } = string.Empty;

    [JsonPropertyName("id_zaman_farki")]
    public double? IdZamanFarki { get; set; }

    [JsonPropertyName("id_frekans_1sn")]
    public double IdFrekans1sn { get; set; }

    [JsonPropertyName("max_data_sapma")]
    public double MaxDataSapma { get; set; }
}

public class TahminResponse
{
    public string Tahmin { get; set; } = string.Empty;
    public Dictionary<string, double> Olasiliklar { get; set; } = new();
}