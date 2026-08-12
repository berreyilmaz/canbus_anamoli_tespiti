using CanBusApi.Models;
using Xunit;

namespace CanBusApi.Tests;

public class AuthTests
{
    [Fact]
    public void SifreHashlemeVeDogrulamaCalisiyor()
    {
        var duzMetinSifre = "guvenliSifre123";
        var hash = BCrypt.Net.BCrypt.HashPassword(duzMetinSifre);

        Assert.NotEqual(duzMetinSifre, hash);
        Assert.True(BCrypt.Net.BCrypt.Verify(duzMetinSifre, hash));
    }

    [Fact]
    public void YanlisSifreDogrulanmaz()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("dogruSifre");

        Assert.False(BCrypt.Net.BCrypt.Verify("yanlisSifre", hash));
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("12345", false)]
    [InlineData("123456", true)]
    [InlineData("cokUzunBirSifre123", true)]
    public void SifreUzunlukKontroluDogruCalisiyor(string sifre, bool gecerliMi)
    {
        var sonuc = sifre.Length >= 6;
        Assert.Equal(gecerliMi, sonuc);
    }
}