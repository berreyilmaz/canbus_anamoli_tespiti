namespace CanBusApi.Models;

public class PredictionLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CanIdHex { get; set; } = string.Empty;
    public string Tahmin { get; set; } = string.Empty;
    public double Olasilik { get; set; }
    public DateTime Zaman { get; set; } = DateTime.UtcNow;
}