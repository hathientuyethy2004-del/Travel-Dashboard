# AI/ML Governance

## Danh sách bảng

- [Bảng 1. Mô tả - Feature, Weight, Rationale](#mô-tả)
- [Bảng 2. Model Governance - Aspect, Trạng thái](#model-governance)
- [Bảng 3. Recommendation Rules (hiện tại) - Rule, Logic](#recommendation-rules-hiện-tại)
- [Bảng 4. Roadmap AI/ML - Priority, Feature, Mô tả](#roadmap-aiml)

## Trạng thái hiện tại

Smart Travel Platform chưa triển khai ML model chính thức. Tuy nhiên, hệ thống sử dụng **heuristic scoring** (quality score) và **fuzzy matching** như một dạng "light ML".

---

## Quality Score Model

### Mô tả

Quality score là một linear weighted model để đánh giá chất lượng POI:

```python
score = w1 * has_osm + w2 * has_google + w3 * rating_normalized + w4 * has_name + w5 * has_address
```

**Bảng 1. Mô tả - Feature, Weight, Rationale.**

| Feature | Weight | Rationale |
|---------|--------|-----------|
| has_osm_data | 0.30 | Xác nhận tồn tại trong OSM |
| has_google_data | 0.30 | Có review/rating thực |
| rating (normalized) | 0–0.20 | Chất lượng được cộng đồng xác nhận |
| valid_name | 0.10 | Có thể nhận dạng được |
| has_address | 0.10 | Có thể navigate đến |

### Model Governance

**Bảng 2. Model Governance - Aspect, Trạng thái.**

| Aspect | Trạng thái |
|--------|-----------|
| Version | v1.0 (hardcoded) |
| Training data | Không áp dụng (rule-based) |
| Bias monitoring | Không áp dụng |
| Explainability | Cao (công thức rõ ràng) |
| Audit trail | Mỗi record lưu quality_score |

---

## Fuzzy Name Matching

### Mô tả

Dùng để match tên POI từ OSM với tên từ Google Places.

- **Algorithm:** Token set ratio (difflib SequenceMatcher)
- **Threshold:** >= 70% similarity
- **Preprocessing:** Lowercase, bỏ dấu, bỏ ký tự đặc biệt

### Known Limitations

- Tên ngắn (< 5 ký tự) có thể cho false positive
- Tên phổ biến (ví dụ: "Café") có thể match sai
- Không xét context ngữ nghĩa

---

## Recommendations Feature

Dashboard có tab Recommendations. Đây là tính năng:
- **Hiện tại:** Rule-based suggestions từ Gold layer
- **Roadmap:** ML-based personalized recommendations

### Recommendation Rules (hiện tại)

**Bảng 3. Recommendation Rules (hiện tại) - Rule, Logic.**

| Rule | Logic |
|------|-------|
| Top-rated by city | Gold POIs, `ORDER BY rating DESC, review_count DESC` |
| Recently added | Gold POIs, `ORDER BY promoted_at DESC` |
| High quality | Gold POIs, `ORDER BY quality_score DESC` |

---

## Roadmap AI/ML

**Bảng 4. Roadmap AI/ML - Priority, Feature, Mô tả.**

| Priority | Feature | Mô tả |
|----------|---------|-------|
| Medium | Smart deduplication | ML model phát hiện trùng lặp chính xác hơn fuzzy matching |
| Medium | Category auto-tagging | NLP classify POI vào danh mục từ text description |
| Low | Personalized recommendations | Collaborative filtering |
| Low | Anomaly detection | Tự động phát hiện dữ liệu bất thường |
