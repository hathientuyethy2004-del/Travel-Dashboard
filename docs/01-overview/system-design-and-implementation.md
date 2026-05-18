# Chương 3. Thiết kế và Triển khai hệ thống

## Danh sách bảng

- [Bảng 1. Các thành phần hệ thống - Thành phần, Vai trò](#các-thành-phần-hệ-thống)
- [Bảng 2. Mô hình dữ liệu - Collection, Mục đích](#mô-hình-dữ-liệu)

## 3.1. Tổng quan chương

Mục tiêu của chương là chứng minh hệ thống được thiết kế có logic và có thể triển khai được trong thực tế. Thay vì mô tả riêng lẻ từng công nghệ, chương này đặt chúng vào đúng vai trò trong một nền tảng dữ liệu du lịch hoàn chỉnh: thu thập dữ liệu, làm giàu, chuẩn hóa, phân lớp, phục vụ API và hiển thị trên dashboard.

Hệ thống hiện được triển khai theo hướng thực dụng:

- Dữ liệu đầu vào đến từ OpenStreetMap và Google Places.
- Xử lý theo batch với kiến trúc Bronze → Silver → Gold.
- Cơ sở dữ liệu chính là MongoDB Atlas.
- Dashboard và API được tách biệt thành hai lớp riêng.
- Triển khai local dùng Docker Compose, triển khai chính chạy trên container Replit.

Thiết kế này phù hợp với phạm vi dự án vì dữ liệu POI không đòi hỏi streaming thời gian thực, nhưng vẫn cần kiểm soát chất lượng, truy vết và khả năng mở rộng về sau.

## 3.2. Kiến trúc tổng thể hệ thống

### 3.2.1. Kiến trúc tổng quan

Hệ thống được tổ chức thành ba lớp chính:

- Lớp giao diện người dùng: dashboard React/Vite.
- Lớp trung gian: API Server Node.js/Express.
- Lớp xử lý dữ liệu: ETL Service Python/FastAPI.

Luồng tổng quát của hệ thống:

```txt
Data Sources
    ↓
Ingestion / ETL Service
    ↓
Bronze Layer
    ↓
Silver Layer
    ↓
Gold Layer
    ↓
API & Analytics
    ↓
Dashboard / Reports / External Consumers
```

ETL Service chịu trách nhiệm thu thập và xử lý dữ liệu từ nguồn ngoài, API Server cung cấp REST API cho dashboard và consumer khác, còn dashboard hiển thị số liệu vận hành, thống kê và công cụ tra cứu POI.

### 3.2.2. Kiến trúc Lakehouse

Dự án tham chiếu tư duy Lakehouse và Medallion Architecture, nhưng chỉ triển khai phần phù hợp với quy mô hiện tại. Cụ thể:

- `Bronze` lưu dữ liệu thô gần nguồn.
- `Silver` lưu dữ liệu đã làm sạch và chấm điểm.
- `Gold` lưu dữ liệu chuẩn phục vụ nghiệp vụ và dashboard.

Hệ thống hiện chưa triển khai đầy đủ các thành phần lakehouse nặng như Spark, Iceberg, Trino, MinIO hay OpenMetadata. Các công nghệ này được xem là hướng mở rộng nếu dữ liệu tăng mạnh hoặc cần phân tích quy mô lớn hơn. Với phạm vi hiện tại, mô hình Medallion trên MongoDB là đủ để bảo toàn dữ liệu gốc và kiểm soát chất lượng.

### 3.2.3. Các thành phần hệ thống

**Bảng 1. Các thành phần hệ thống - Thành phần, Vai trò.**

| Thành phần | Vai trò |
|------------|---------|
| Dashboard | Hiển thị KPI, POI Explorer, Analytics, Reports, Settings |
| API Server | Cung cấp REST API, proxy một phần ETL, đọc Gold layer |
| ETL Service | Thu thập, enrich, validate, scoring và promote dữ liệu |
| MongoDB Atlas | Lưu Bronze/Silver/Gold, job state, review queue, config |
| Nguồn ngoài | OpenStreetMap, Google Places, RapidAPI |

## 3.3. Thiết kế dữ liệu

### 3.3.1. Mô hình dữ liệu

Hệ thống sử dụng mô hình document của MongoDB thay vì schema quan hệ cứng. Cách này phù hợp với dữ liệu POI vì các nguồn khác nhau thường có trường dữ liệu không đồng nhất.

Các collection chính:

**Bảng 2. Mô hình dữ liệu - Collection, Mục đích.**

| Collection | Mục đích |
|------------|----------|
| `bronze_pois` | Lưu dữ liệu gốc từ nguồn ngoài |
| `silver_pois` | Lưu bản ghi đã chuẩn hóa và chấm điểm |
| `gold_master_pois` | Lưu bản ghi chuẩn phục vụ API và dashboard |
| `pending_review_pois` | Lưu bản ghi cần người duyệt |
| `data_quality_quarantine` | Lưu bản ghi lỗi hoặc không đạt chuẩn |
| `etl_jobs` | Lưu trạng thái và lịch sử job |
| `etl_schedules` | Lưu lịch chạy tự động |
| `config_cities` | Lưu danh mục thành phố và metadata |

Khóa định danh xuyên suốt là `u_key`. Trường này được dùng để hợp nhất bản ghi giữa các lớp và tránh nhân bản dữ liệu khi nguồn ngoài thay đổi.

### 3.3.2. Quy chuẩn dữ liệu

Các quy chuẩn dữ liệu chính trong hệ thống gồm:

- `snake_case` cho tên collection và field.
- Dữ liệu ngày giờ dùng định dạng ISO 8601.
- Thành phố và danh mục được chuẩn hóa theo danh mục cấu hình.
- Dữ liệu đầu vào phải qua validation trước khi lên lớp Silver/Gold.
- Metadata gắn với bản ghi để phục vụ truy vết và audit.

### 3.3.3. Phân lớp dữ liệu

Ba lớp dữ liệu phản ánh mức độ xử lý và độ tin cậy:

- `Bronze`: dữ liệu thô, gần nguồn, lưu raw JSON.
- `Silver`: dữ liệu đã làm sạch, hợp nhất và tính `quality_score`.
- `Gold`: dữ liệu đã đủ tin cậy để phục vụ dashboard và API.

Ngoài ba lớp chính, hệ thống còn có hai vùng hỗ trợ:

- `pending_review_pois` cho bản ghi cần duyệt thủ công.
- `data_quality_quarantine` cho bản ghi không đạt kiểm tra chất lượng.

### 3.3.4. Metadata và Lineage

Metadata và lineage được dùng để biết một bản ghi Gold đến từ đâu, đã qua những bước xử lý nào và được tạo ra bởi job nào. Tư duy này giúp hệ thống dễ kiểm tra lỗi, dễ giải thích dữ liệu và thuận tiện khi cần rebuild Silver/Gold.

`config_cities` cũng đóng vai trò reference data. API `/api/cities` đọc từ collection này và kết hợp thống kê từ `gold_master_pois`, nhờ đó tránh hard-code thành phố trong code.

## 3.4. Quy trình thu thập dữ liệu

### 3.4.1. Nguồn dữ liệu

Hệ thống hiện sử dụng hai nguồn chính:

- OpenStreetMap, truy cập qua Overpass API.
- Google Places, truy cập qua RapidAPI.

Hai nguồn này được chọn vì bổ sung cho nhau: OSM có độ phủ rộng và dễ truy cập, trong khi Google Places giúp làm giàu các trường như rating, review và thông tin liên hệ.

### 3.4.2. Quy trình ingestion

Luồng ingestion cơ bản:

1. Chọn thành phố và danh mục từ `config_cities`.
2. Gửi yêu cầu đến Overpass API hoặc RapidAPI.
3. Nhận dữ liệu JSON và chuẩn hóa sơ bộ.
4. Upsert vào `bronze_pois` theo `u_key`.
5. Gắn metadata ingestion như thời gian, nguồn, trạng thái.

```txt
OpenStreetMap / Google Places
        ↓
    ETL Service
        ↓
    bronze_pois
```

### 3.4.3. Quy chuẩn thu thập dữ liệu

Quy trình thu thập áp dụng các chuẩn:

- Chỉ nhận city code hợp lệ trong `config_cities`.
- Dữ liệu đầu vào phải có mã hóa UTF-8.
- Request tới nguồn ngoài phải có retry và xử lý timeout.
- Dữ liệu sau thu thập phải được chuẩn hóa tên, địa chỉ và location.

## 3.5. Quy trình xử lý dữ liệu

### 3.5.1. Pipeline xử lý dữ liệu

Pipeline của hệ thống là batch pipeline theo mô hình:

```txt
Collect → Bronze → Validate/Enrich → Silver → Promote/Review → Gold
```

Thiết kế này phù hợp vì dữ liệu du lịch thay đổi theo chu kỳ, không cần real-time streaming. Việc xử lý theo batch giúp giảm độ phức tạp và dễ kiểm soát chất lượng hơn.

### 3.5.2. Workflow orchestration

APScheduler được dùng để lên lịch job định kỳ, trong đó `nightly_sync` là job quan trọng nhất. Một số bước rebuild Silver/Gold có thể dùng aggregation `$out` để đồng bộ nhanh khi dữ liệu đã ổn định.

Hệ thống hiện không dùng Airflow hay DAG orchestration đầy đủ. Lý do là quy mô hiện tại chưa đủ lớn để cần một orchestrator nặng. APScheduler đủ đáp ứng cho job định kỳ, retry cơ bản và tracking trạng thái.

### 3.5.3. Làm sạch và biến đổi dữ liệu

Các bước biến đổi chính:

- Chuẩn hóa tên POI và địa chỉ.
- Hợp nhất dữ liệu từ OSM và Google Places.
- Chuẩn hóa `phone`, `website`, `rating`, `location`.
- Loại bỏ bản ghi thiếu trường bắt buộc.
- Dedup theo `u_key` và tiêu chí trùng gần đúng.

### 3.5.4. Kiểm tra chất lượng dữ liệu

Chất lượng dữ liệu được đánh giá theo các tiêu chí:

- Có tên hợp lệ.
- Có location hợp lệ.
- Có địa chỉ hoặc thông tin liên hệ.
- Có dữ liệu từ một hoặc nhiều nguồn.
- Có `quality_score` đạt ngưỡng.

Kết quả chất lượng quyết định bản ghi sẽ:

- Được promote lên Gold.
- Chuyển sang Pending Review.
- Hoặc bị đưa vào Quarantine.

## 3.6. Governance và bảo mật dữ liệu

### 3.6.1. Data Governance

Hệ thống áp dụng quản trị dữ liệu ở mức vừa đủ:

- `gold_master_pois` là nguồn dữ liệu chính thức cho dashboard và API.
- `pending_review_pois` là vùng kiểm soát dữ liệu trung gian.
- `data_quality_quarantine` lưu dữ liệu không đạt chuẩn để xử lý sau.
- Các thay đổi dữ liệu có thể truy ngược qua metadata và job history.

### 3.6.2. Metadata Governance

Metadata governance tập trung vào:

- Theo dõi nguồn gốc dữ liệu.
- Lưu trạng thái job và lịch chạy.
- Lưu cấu hình thành phố, danh mục và nguồn dữ liệu.
- Hỗ trợ giải thích dữ liệu khi dashboard hoặc API có sai lệch.

### 3.6.3. Bảo mật hệ thống

Thiết kế bảo mật dựa trên các nguyên tắc:

- Secrets lưu ngoài source code.
- Kết nối ngoài dùng TLS.
- API validation bằng Zod và Pydantic.
- Proxy nội bộ hạn chế truy cập trực tiếp vào service.
- RapidAPI keys được luân chuyển để giảm rủi ro quota.

Về phân quyền, hệ thống hiện phù hợp với RBAC đơn giản:

- Admin.
- Data Engineer.
- Data Steward.
- API Consumer.

## 3.7. Thiết kế triển khai hệ thống

### 3.7.1. Môi trường triển khai

Hệ thống có hai môi trường chính:

- Local development bằng Docker Compose.
- Environment chạy chính trên Replit container.

Hướng triển khai này cho phép phát triển cục bộ thuận tiện nhưng vẫn giữ được khả năng chạy trực tuyến ổn định.

### 3.7.2. Kiến trúc container

Docker Compose được dùng để khởi chạy đồng thời:

- `frontend`
- `api`
- `etl`
- `mongodb`

Các service giao tiếp với nhau qua network nội bộ:

- Dashboard gọi API qua `/api`.
- API server proxy một phần yêu cầu đến ETL service.
- ETL service đọc/ghi MongoDB Atlas và gọi nguồn ngoài.

```txt
Dashboard → API Server → ETL Service → MongoDB Atlas
                    ↘
                     REST API / Reports / Analytics
```

### 3.7.3. CI/CD và vận hành

Hệ thống vận hành theo hướng đơn giản:

- Git workflow để quản lý thay đổi mã nguồn.
- Build và verify theo từng service.
- Logging có cấu trúc cho API server.
- Job state lưu trực tiếp trong MongoDB.
- Có thể rebuild toàn bộ Silver/Gold khi cần.

## 3.8. Giao diện và API hệ thống

### 3.8.1. Dashboard và Monitoring

Dashboard tập trung vào các màn hình chính:

- Tổng quan KPI.
- POI Explorer.
- Analytics.
- Pipeline Monitor.
- Reports.
- Settings.

Mục tiêu của dashboard là giúp người dùng nhìn nhanh trạng thái dữ liệu, chất lượng và tiến trình pipeline thay vì phải truy vấn trực tiếp MongoDB.

### 3.8.2. API hệ thống

REST API là lớp giao tiếp chính của hệ thống. Các nhóm endpoint quan trọng gồm:

- `/api/healthz`
- `/api/dashboard/*`
- `/api/pois/*`
- `/api/cities`
- `/api/pipeline/*`
- `/api/reports/*`
- `/api/etl/*`

Trong đó:

- `/api/cities` đọc từ `config_cities` và thống kê từ `gold_master_pois`.
- `/api/pois` phục vụ dữ liệu Gold cho dashboard và consumer.
- `/api/etl` điều khiển job, review và lịch chạy.

OpenAPI được dùng làm hợp đồng API để bảo đảm tài liệu, backend và frontend không lệch nhau.

## 3.9. Tổng kết chương

Hệ thống Smart Travel Platform được thiết kế theo hướng nhiều lớp, batch processing và REST-based serving. Cách thiết kế này phù hợp với bài toán dữ liệu du lịch quy mô nhỏ đến trung bình vì vừa đủ đơn giản để triển khai, vừa đủ chặt chẽ để kiểm soát chất lượng, truy vết và vận hành.

Điểm chính của chương:

- Kiến trúc hệ thống tách rõ dashboard, API và ETL.
- Dữ liệu được tổ chức theo Bronze/Silver/Gold.
- Quy trình xử lý ưu tiên batch thay vì streaming.
- Bảo mật và governance được triển khai ở mức thực dụng.
- Docker Compose và Replit container giúp triển khai nhất quán.

### Tài liệu nội bộ tham chiếu

- [Kiến trúc tổng thể](./architecture.md)
- [Thiết kế pipeline](../03-pipeline/pipeline-architecture.md)
- [Luồng dữ liệu](../03-pipeline/data-flow.md)
- [API overview](../10-api/api-overview.md)
- [Security architecture](../06-security/security-architecture.md)
- [Infrastructure](../09-infrastructure/infrastructure.md)
- [Docker deployment](../08-operations/docker-deployment.md)
- [Deployment guide](../08-operations/deployment-guide.md)
