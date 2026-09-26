# Aidat Takip

Aidat / salma / dergi / kitap ödemelerini ve bunların teslimatlarını takip eden web uygulaması.

- **Frontend:** React 18 + Vite (`client/`)
- **Backend:** Node.js + Express, JWT ile giriş (`server/`)
- **Veritabanı:** PostgreSQL 16 (Docker)

## Kurulum

Gereksinimler: Node.js 20+ ve Docker.

```bash
npm run setup          # tüm bağımlılıkları kurar
cp server/.env.example server/.env   # JWT_SECRET'ı değiştirin
npm run db:up          # PostgreSQL container'ını başlatır
npm run dev            # API (4000) + arayüz (5173)
```

Tarayıcıda http://localhost:5173 adresini açın. Tablolar ilk açılışta otomatik oluşturulur.
Hiç admin yoksa `.env` içindeki `ADMIN_USERNAME` / `ADMIN_PASSWORD` ile bir admin oluşturulur
(varsayılan `admin` / `admin123` — ilk girişten sonra Kullanıcılar ekranından değiştirin).

### Production

```bash
npm run build   # client/dist oluşturur
npm start       # API + derlenmiş arayüz tek porttan (4000) sunulur
```

## Ekranlar

| Ekran | Kim | Ne yapar |
|---|---|---|
| Ödemeler | Admin | Tüm ödemeler; varsayılan sıralama giriş tarihine göre yeniden eskiye. Teslim edilmemiş ödemeler düzenlenebilir/silinebilir. |
| Ödemelerim | User | Sadece kendi ödemeleri (salt okunur) ve eksik aidat ayları. |
| Kullanıcı Ödemeleri | Admin | Dropdown'dan seçilen kullanıcının ödemeleri ve eksik aidat ayları. |
| Şifre değiştir | Herkes | Mevcut şifreyi doğrulayıp yeni şifre belirler. |
| Ödeme Girişi | Admin | Kullanıcı, miktar, ay/yıl, tip (varsayılan Aidat), ödeme şekli (Nakit/IBAN, opsiyonel), açıklama. Tip "Diğer" ise ek açıklama alanı çıkar. |
| Teslimatlar | Admin | Yapılan teslimatlar, tip bazında tutarlar; her teslimatın ödemeleri görüntülenebilir. Teslimat silinirse ödemeleri tekrar "teslim edilmedi" olur. |
| Teslimat Girişi | Admin | Sadece teslim edilmemiş ödemeler listelenir; çoklu seçim, seçim değiştikçe toplam + tip kırılımı güncellenir. |
| Kullanıcılar | Admin | İsim, kullanıcı adı, şifre, rol, başlangıç ayı ve (opsiyonel) bitiş ayı. |

Tüm tablolarda her kolon başlığındaki **▾** ile Excel benzeri filtre açılır: artan/azalan sıralama,
arama ve çoklu seçimli değer listesi. Kolon adına tıklamak da sıralamayı değiştirir.

## Kurallar

- **Eksik aidat:** başlangıç ayından, bitiş ayı ile bu aydan hangisi önceyse ona kadar (bu ay dahil),
  "Aidat" tipinde ödemesi olmayan her ay eksik sayılır. Diğer tipler (salma, dergi…) aidat yerine geçmez.
  Başlangıç ayı olmayan kullanıcılar (ör. admin) için hesaplanmaz.

- Teslim edilmiş bir ödeme değiştirilemez / silinemez (önce teslimat silinmeli).
- Ödemesi olan kullanıcı silinemez; bitiş ayı girilerek pasife alınır.
- Seçilen ay kullanıcının başlangıç–bitiş aralığı dışındaysa giriş ekranı uyarı verir (engellemez).

## Veritabanını sıfırlama

```bash
docker compose down -v && npm run db:up
```
