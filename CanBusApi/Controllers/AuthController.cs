using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CanBusApi.Data;
using CanBusApi.Models;
using BCrypt.Net;

namespace CanBusApi.Controllers;

public class RegisterRequest
{
    public string KullaniciAdi { get; set; } = string.Empty;
    public string Sifre { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string KullaniciAdi { get; set; } = string.Empty;
    public string Sifre { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public AuthController(IConfiguration config, AppDbContext db)
    {
        _config = config;
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest istek)
    {
        if (string.IsNullOrWhiteSpace(istek.KullaniciAdi) || string.IsNullOrWhiteSpace(istek.Sifre))
        {
            return BadRequest(new { hata = "Kullanıcı adı ve şifre zorunludur" });
        }

        if (istek.Sifre.Length < 6)
        {
            return BadRequest(new { hata = "Şifre en az 6 karakter olmalıdır" });
        }

        var mevcutKullanici = await _db.Users.FirstOrDefaultAsync(u => u.KullaniciAdi == istek.KullaniciAdi);
        if (mevcutKullanici is not null)
        {
            return Conflict(new { hata = "Bu kullanıcı adı zaten kayıtlı" });
        }

        var yeniKullanici = new User
        {
            KullaniciAdi = istek.KullaniciAdi,
            SifreHash = BCrypt.Net.BCrypt.HashPassword(istek.Sifre),
            Rol = "Viewer"
        };

        _db.Users.Add(yeniKullanici);
        await _db.SaveChangesAsync();

        return Ok(new { mesaj = "Kayıt başarılı, giriş yapabilirsiniz" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest istek)
    {
        var kullanici = await _db.Users.FirstOrDefaultAsync(u => u.KullaniciAdi == istek.KullaniciAdi);

        if (kullanici is null || !BCrypt.Net.BCrypt.Verify(istek.Sifre, kullanici.SifreHash))
        {
            return Unauthorized(new { hata = "Geçersiz kullanıcı adı veya şifre" });
        }

        var claims = new[]
{
            new Claim(ClaimTypes.NameIdentifier, kullanici.Id.ToString()),
            new Claim(ClaimTypes.Name, kullanici.KullaniciAdi),
            new Claim(ClaimTypes.Role, kullanici.Rol)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
    }
}