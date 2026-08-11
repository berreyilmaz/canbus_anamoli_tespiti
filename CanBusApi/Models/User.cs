namespace CanBusApi.Models;

public class User
{
    public int Id { get; set; }
    public string KullaniciAdi { get; set; } = string.Empty;
    public string SifreHash { get; set; } = string.Empty;
    public string Rol { get; set; } = "Viewer";
    public DateTime OlusturulmaTarihi { get; set; } = DateTime.UtcNow;
}