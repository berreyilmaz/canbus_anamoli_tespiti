
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { login, register, predict, getHistory, setToken } from "./api";
import { useState, useEffect } from "react";
import "./App.css";
import * as XLSX from "xlsx";

const RENK_HARITASI = {
  Normal: "#0ea472",
  DoS: "#e0393e",
  Fuzzy: "#f59e0b",
  Gear: "#8b5cf6",
  RPM: "#0284c7",
};

function App() {
  const [girisYapildi, setGirisYapildi] = useState(false);
  const [kullaniciAdi, setKullaniciAdi] = useState("berre");
  const [sifre, setSifre] = useState("test123");
  const [girisHatasi, setGirisHatasi] = useState("");

  const [canIdHex, setCanIdHex] = useState("0000");
  const [idFrekans1sn, setIdFrekans1sn] = useState(500);
  const [maxDataSapma, setMaxDataSapma] = useState(0.1);
  const [idZamanFarki, setIdZamanFarki] = useState("");

  const [tahminGecmisi, setTahminGecmisi] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState("");

  const [ekranModu, setEkranModu] = useState("giris"); 
  const [kayitBasarili, setKayitBasarili] = useState("");

  const [simulasyonMesajlari, setSimulasyonMesajlari] = useState([]);
  const [yuklenenDosyaAdi, setYuklenenDosyaAdi] = useState("");
  const [dosyaHatasi, setDosyaHatasi] = useState("");

  const [simulasyonCalisiyor, setSimulasyonCalisiyor] = useState(false);
  const [simulasyonIlerleme, setSimulasyonIlerleme] = useState(0);

  async function handleLogin(e) {
    e.preventDefault();
    setGirisHatasi("");
    try {
      const token = await login(kullaniciAdi, sifre);
      setToken(token);
      setGirisYapildi(true);
    } catch (err) {
      setGirisHatasi("Giriş başarısız: kullanıcı adı veya şifre yanlış");
    }
  }
  useEffect(() => {
    if (!girisYapildi) return;

    function gecmisiCek() {
      getHistory()
        .then((kayitlar) => {
          const formatli = kayitlar.map((k) => ({
            zaman: new Date(k.zaman).toLocaleTimeString("tr-TR"),
            canId: k.canIdHex,
            tahmin: k.tahmin,
            olasilik: k.olasilik,
            saldiriMi: k.tahmin !== "Normal",
          }));
          setTahminGecmisi(formatli);
        })
        .catch(() => {});
    }

    gecmisiCek();

    const interval = setInterval(gecmisiCek, 3000);

    return () => clearInterval(interval);
  }, [girisYapildi]);

  async function handleRegister(e) {
    e.preventDefault();
    setGirisHatasi("");
    setKayitBasarili("");
    try {
      await register(kullaniciAdi, sifre);
      setKayitBasarili("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
      setEkranModu("giris");
    } catch (err) {
      if (err.response?.status === 409) {
        setGirisHatasi("Bu kullanıcı adı zaten kayıtlı");
      } else if (err.response?.data?.hata) {
        setGirisHatasi(err.response.data.hata);
      } else {
        setGirisHatasi("Kayıt sırasında bir hata oluştu");
      }
    }
  }

  async function handlePredict(e) {
    e.preventDefault();
    setHataMesaji("");
    setYukleniyor(true);

    try {
      const sonuc = await predict({
        canIdHex,
        idZamanFarki: idZamanFarki === "" ? null : Number(idZamanFarki),
        idFrekans1sn: Number(idFrekans1sn),
        maxDataSapma: Number(maxDataSapma),
      });

      const yeniKayit = {
        zaman: new Date().toLocaleTimeString("tr-TR"),
        canId: canIdHex,
        tahmin: sonuc.tahmin,
        olasilik: sonuc.olasiliklar[sonuc.tahmin],
        saldiriMi: sonuc.tahmin !== "Normal",
      };

      setTahminGecmisi((onceki) => [yeniKayit, ...onceki].slice(0, 20));
    } catch (err) {
      setHataMesaji(err.message || "Tahmin sırasında bir hata oluştu");
    } finally {
      setYukleniyor(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setGirisYapildi(false);
    setTahminGecmisi([]);
    setKullaniciAdi("");
    setSifre("");
  }

  function satirlariNormallestir(satirlar) {
    const gerekliSutunlar = ["canIdHex", "idFrekans1sn", "maxDataSapma"];
    if (satirlar.length === 0) return [];

    const mevcutSutunlar = Object.keys(satirlar[0]);
    const eksikSutun = gerekliSutunlar.find((s) => !mevcutSutunlar.includes(s));
    if (eksikSutun) {
      throw new Error(`Dosyada '${eksikSutun}' sütunu eksik`);
    }

    return satirlar.map((satir) => ({
      canIdHex: String(satir.canIdHex).trim(),
      idZamanFarki: satir.idZamanFarki === undefined || satir.idZamanFarki === "" ? null : Number(satir.idZamanFarki),
      idFrekans1sn: Number(satir.idFrekans1sn),
      maxDataSapma: Number(satir.maxDataSapma),
    }));
  }

  function csvMetniniAyristir(metin) {
    const satirlar = metin.trim().split("\n");
    const basliklar = satirlar[0].split(",").map((b) => b.trim());

    const gerekliSutunlar = ["canIdHex", "idFrekans1sn", "maxDataSapma"];
    const eksikSutun = gerekliSutunlar.find((s) => !basliklar.includes(s));
    if (eksikSutun) {
      throw new Error(`CSV dosyasında '${eksikSutun}' sütunu eksik`);
    }

    return satirlar.slice(1).filter((s) => s.trim() !== "").map((satir) => {
      const degerler = satir.split(",");
      const kayit = {};
      basliklar.forEach((baslik, index) => {
        const deger = degerler[index]?.trim() ?? "";
        if (baslik === "canIdHex") {
          kayit[baslik] = deger;
        } else {
          kayit[baslik] = deger === "" ? null : Number(deger);
        }
      });
      return kayit;
    });
  }

    function handleDosyaSecildi(e) {
    const dosya = e.target.files[0];
    if (!dosya) return;

    setDosyaHatasi("");
    const dosyaAdi = dosya.name.toLowerCase();
    const excelMi = dosyaAdi.endsWith(".xlsx") || dosyaAdi.endsWith(".xls");

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let mesajlar;

        if (excelMi) {
          const workbook = XLSX.read(event.target.result, { type: "binary" });
          const ilkSayfa = workbook.Sheets[workbook.SheetNames[0]];
          const satirlar = XLSX.utils.sheet_to_json(ilkSayfa);
          mesajlar = satirlariNormallestir(satirlar);
        } else {
          mesajlar = csvMetniniAyristir(event.target.result);
        }

        if (mesajlar.length === 0) {
          throw new Error("Dosyada geçerli veri satırı bulunamadı");
        }
        setSimulasyonMesajlari(mesajlar);
        setYuklenenDosyaAdi(dosya.name);
      } catch (err) {
        setDosyaHatasi(err.message);
        setSimulasyonMesajlari([]);
        setYuklenenDosyaAdi("");
      }
    };

    reader.onerror = () => {
      setDosyaHatasi("Dosya okunamadı");
    };

    if (excelMi) {
      reader.readAsBinaryString(dosya);
    } else {
      reader.readAsText(dosya);
    }
  }

  async function handleSimulasyonBaslat() {
    setSimulasyonCalisiyor(true);
    setSimulasyonIlerleme(0);

    for (let i = 0; i < simulasyonMesajlari.length; i++) {
      try {
        await predict({
          canIdHex: simulasyonMesajlari[i].canIdHex,
          idZamanFarki: simulasyonMesajlari[i].idZamanFarki ?? null,
          idFrekans1sn: simulasyonMesajlari[i].idFrekans1sn,
          maxDataSapma: simulasyonMesajlari[i].maxDataSapma,
        });
      } catch (err) {
        // devam et
      }

      setSimulasyonIlerleme(i + 1);
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }

    setSimulasyonCalisiyor(false);
  }

  if (!girisYapildi) {
    return (
      <div className="giris-container">
        <form onSubmit={ekranModu === "giris" ? handleLogin : handleRegister} className="giris-form">
          <h1>{ekranModu === "giris" ? "CAN Bus Anomali Tespit" : "Yeni Hesap Oluştur"}</h1>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
          />
          <input
            type="password"
            placeholder="Şifre"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
          />
          <button type="submit">
            {ekranModu === "giris" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
          {girisHatasi && <p className="hata-metni">{girisHatasi}</p>}
          {kayitBasarili && <p className="basari-metni">{kayitBasarili}</p>}
          <p className="ekran-degistir">
            {ekranModu === "giris" ? (
              <>Hesabın yok mu? <span onClick={() => { setEkranModu("kayit"); setGirisHatasi(""); }}>Kayıt ol</span></>
            ) : (
              <>Zaten hesabın var mı? <span onClick={() => { setEkranModu("giris"); setGirisHatasi(""); }}>Giriş yap</span></>
            )}
          </p>
        </form>
      </div>
    );
  }

  const grafikVerisi = [...tahminGecmisi].reverse();

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>CAN Bus Anomali Tespit Dashboard</h1>
        <button onClick={handleLogout} className="cikis-butonu">Çıkış Yap</button>
      </div>

      <form onSubmit={handlePredict} className="tahmin-form">
        <label>
          CAN ID (hex)
          <input value={canIdHex} onChange={(e) => setCanIdHex(e.target.value)} />
        </label>
        <label>
          Frekans (1 saniyede kaç mesaj)
          <input
            type="number"
            value={idFrekans1sn}
            onChange={(e) => setIdFrekans1sn(e.target.value)}
          />
        </label>
        <label>
          Veri Sapması
          <input
            type="number"
            step="0.01"
            value={maxDataSapma}
            onChange={(e) => setMaxDataSapma(e.target.value)}
          />
        </label>
        <label>
          Zaman Farkı (saniye, opsiyonel)
          <input
            type="number"
            step="0.0001"
            placeholder="boş = medyan kullanılır"
            value={idZamanFarki}
            onChange={(e) => setIdZamanFarki(e.target.value)}
          />
        </label>
        <button type="submit" disabled={yukleniyor}>
          {yukleniyor ? "Analiz ediliyor..." : "Mesajı Analiz Et"}
        </button>
        {hataMesaji && <p className="hata-metni">{hataMesaji}</p>}
      </form>

      <div className="simulasyon-container">
        <div className="simulasyon-ust">
          <div>
            <h2>Trafik Simülasyonu</h2>
            <p className="simulasyon-aciklama">
              CAN mesajı verisi içeren bir CSV veya Excel dosyası yükleyin (canIdHex, idZamanFarki, idFrekans1sn, maxDataSapma sütunları) ve otomatik olarak analiz edin.
            </p>
          </div>
          <div className="dosya-yukleme">
            <label className="dosya-butonu">
              Dosya Seç
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleDosyaSecildi} hidden />
            </label>
            {yuklenenDosyaAdi && (
              <span className="dosya-adi">{yuklenenDosyaAdi} ({simulasyonMesajlari.length} kayıt)</span>
            )}
          </div>
        </div>
        {dosyaHatasi && <p className="hata-metni">{dosyaHatasi}</p>}
        <button
          onClick={handleSimulasyonBaslat}
          disabled={simulasyonCalisiyor || simulasyonMesajlari.length === 0}
          className="simulasyon-butonu"
        >
          {simulasyonCalisiyor
            ? `Çalışıyor... (${simulasyonIlerleme}/${simulasyonMesajlari.length})`
            : "Simülasyonu Başlat"}
        </button>
      </div>

      <div className="grafik-container">
        <h2>Olasılık Grafiği (Son 20 İstek)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={grafikVerisi}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zaman" />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="olasilik"
              stroke="#c7cbd6"
              strokeWidth={1.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const renk = RENK_HARITASI[payload.tahmin] || "#94a3b8";
                return <circle key={payload.zaman + payload.canId} cx={cx} cy={cy} r={5} fill={renk} stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
              <div className="lejant">
        {Object.entries(RENK_HARITASI).map(([isim, renk]) => (
          <span key={isim} className="lejant-item">
            <span className="lejant-nokta" style={{ backgroundColor: renk }}></span>
            {isim}
          </span>
        ))}
      </div>
      </div>

      <div className="gecmis-container">
        <h2>Tahmin Geçmişi</h2>
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>CAN ID</th>
              <th>Tahmin</th>
              <th>Olasılık</th>
            </tr>
          </thead>
          <tbody>
            {tahminGecmisi.map((kayit, index) => (
              <tr key={index} className={kayit.saldiriMi ? "saldiri-satiri" : ""}>
                <td>{kayit.zaman}</td>
                <td>{kayit.canId}</td>
                <td>{kayit.tahmin}</td>
                <td>{(kayit.olasilik * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;