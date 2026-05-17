# Analyst Guide — Hướng dẫn Data Analyst

## Tổng quan Dashboard

Smart Travel Platform Dashboard có 6 section chính:

| Section | Mô tả |
|---------|-------|
| **Dashboard** | KPI overview, charts phân bố POI |
| **POI Explorer** | Browse/filter Gold POIs |
| **Analytics** | Advanced analytics by city/category |
| **Recommendations** | Top-rated POI recommendations |
| **Pipeline** | Monitor ETL jobs |
| **Reports** | Báo cáo định kỳ |

---

## Đọc Dashboard

### KPI Cards

| Card | Ý nghĩa |
|------|---------|
| Gold POIs | Số điểm tham quan đã qua kiểm duyệt chất lượng |
| With Address | % Gold POIs có địa chỉ đầy đủ |
| Bronze POIs | Tổng raw data đã thu thập |
| Cities | Số thành phố được hỗ trợ |
| Avg Quality | Điểm chất lượng trung bình (0.0–1.0) |

### Pipeline Funnel

```
Bronze → Silver → Gold → (Quarantine)
```
- **Bronze:** Tất cả raw data từ OSM và Google
- **Silver:** Sau validation và enrichment
- **Gold:** Đã đủ chất lượng (score ≥ 0.5)
- **Quarantine:** Bị loại do thiếu tọa độ/tên

### Quality Distribution

Histogram phân bố quality_score của Gold POIs:
- Score cao (0.8–1.0): Có cả OSM + Google + rating tốt + địa chỉ
- Score trung bình (0.5–0.7): Đủ chuẩn vào Gold nhưng thiếu một số thông tin
- Không thấy score thấp: Vì score < 0.5 không vào Gold

---

## Phân tích theo thành phố

**Đi đến:** Dashboard → POI by City hoặc Analytics → Cities

Câu hỏi gợi ý:
- Thành phố nào có nhiều POI nhất? → Hà Nội / Hồ Chí Minh thường cao nhất
- Tỷ lệ enrichment theo thành phố? → Thành phố lớn thường cao hơn
- Thành phố nào cần thu thập thêm?

---

## Phân tích theo danh mục

**Đi đến:** Dashboard → POI by Category

| Category | Loại POI |
|---------|---------|
| restaurant | Nhà hàng, quán ăn |
| cafe | Quán cà phê |
| bar | Bar, pub |
| hotel | Khách sạn, nhà nghỉ |
| attraction | Điểm tham quan, bảo tàng |
| park | Công viên, vườn |
| shopping | Trung tâm thương mại, siêu thị |

---

## Export dữ liệu

### Từ Dashboard

- Mỗi biểu đồ có nút tải xuống (icon download)
- Format: CSV hoặc PNG

### Từ API

```bash
# Lấy tất cả Gold POIs
curl "http://localhost:8080/api/pois?limit=1000" > pois.json

# Lọc theo thành phố và danh mục
curl "http://localhost:8080/api/pois?city=hanoi&category=restaurant" > hanoi_restaurants.json

# Top-rated
curl "http://localhost:8080/api/pois/top-rated?city=danang&limit=50" > danang_top.json
```

---

## Giải thích các chỉ số

### Quality Score

| Range | Ý nghĩa |
|-------|---------|
| 0.9–1.0 | Hoàn hảo: OSM + Google + rating cao + địa chỉ |
| 0.7–0.89 | Tốt: Có 2 nguồn, đầy đủ thông tin chính |
| 0.5–0.69 | Đạt chuẩn: Vào Gold nhưng thiếu một số thông tin |
| 0.3–0.49 | Cần review thủ công |
| < 0.3 | Chưa đủ chất lượng |

### Enrichment Rate

Tỷ lệ OSM records đã được làm giàu với Google data:
- > 70%: Tốt
- 50–70%: Trung bình
- < 50%: Cần chạy thêm enrich_google job
