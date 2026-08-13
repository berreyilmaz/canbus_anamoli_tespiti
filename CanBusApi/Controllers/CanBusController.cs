using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CanBusApi.Models;
using CanBusApi.Services;
using CanBusApi.Data;

namespace CanBusApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CanBusController : ControllerBase
{
    private readonly CanBusPredictionService _predictionService;
    private readonly ILogger<CanBusController> _logger;
    private readonly AppDbContext _db;

    public CanBusController(CanBusPredictionService predictionService, ILogger<CanBusController> logger, AppDbContext db)
    {
        _predictionService = predictionService;
        _logger = logger;
        _db = db;
    }

    [HttpPost("predict")]
    [Authorize]
    [EnableRateLimiting("PredictPolicy")]
    public async Task<ActionResult<TahminResponse>> Predict([FromBody] CanMesajiRequest istek)
    {
        try
        {
            var sonuc = await _predictionService.TahminYapAsync(istek);

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userId = int.Parse(userIdStr!);

            var kayit = new PredictionLog
            {
                UserId = userId,
                CanIdHex = istek.CanIdHex,
                Tahmin = sonuc.Tahmin,
                Olasilik = sonuc.Olasiliklar.GetValueOrDefault(sonuc.Tahmin, 0)
            };
            _db.PredictionLogs.Add(kayit);
            await _db.SaveChangesAsync();

            if (sonuc.Tahmin == "Normal")
            {
                _logger.LogInformation("Normal trafik tespit edildi. CAN ID: {CanId}", istek.CanIdHex);
            }
            else
            {
                _logger.LogWarning(
                    "SALDIRI TESPİT EDİLDİ! Tür: {SaldiriTuru}, CAN ID: {CanId}, Olasılık: {Olasilik}",
                    sonuc.Tahmin, istek.CanIdHex, kayit.Olasilik
                );
            }

            return Ok(sonuc);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Model servisine ulaşılamadı");
            return StatusCode(502, new { hata = "Model servisine ulaşılamadı", detay = ex.Message });
        }
    }

    [HttpGet("history")]
    [Authorize]
    public async Task<IActionResult> History()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userId = int.Parse(userIdStr!);

        var kayitlar = await _db.PredictionLogs
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.Zaman)
            .Take(50)
            .ToListAsync();

        return Ok(kayitlar);
    }

    [HttpGet("report")]
    [Authorize]
    public async Task<IActionResult> Report()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userId = int.Parse(userIdStr!);

        var sonKayitlar = await _db.PredictionLogs
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.Zaman)
            .Take(10)
            .ToListAsync();

        if (sonKayitlar.Count == 0)
        {
            return BadRequest(new { hata = "Rapor oluşturmak için önce en az bir tahmin yapmalısınız" });
        }

        try
        {
            var rapor = await _predictionService.RaporOlusturAsync(sonKayitlar);
            return Ok(new { rapor });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { hata = "AI rapor servisine ulaşılamadı", detay = ex.Message });
        }
    }
}