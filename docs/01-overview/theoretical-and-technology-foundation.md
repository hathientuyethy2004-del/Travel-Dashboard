# Cơ sở lý thuyết và công nghệ

## Danh sách bảng

- [Bảng 1. So sánh các phương pháp và mô hình - Nhóm so sánh, Lựa chọn thứ nhất, Lựa chọn thứ hai, Nhận xét áp dụng cho dự án](#so-sánh-các-phương-pháp-và-mô-hình)

## 1. Cơ sở lý thuyết

### 1.1. Nền tảng dữ liệu du lịch và bài toán điểm quan tâm

Trong các hệ thống du lịch số, dữ liệu về điểm quan tâm là nền tảng để xây dựng các chức năng như tra cứu địa điểm, phân tích phân bố du lịch, gợi ý điểm đến và hỗ trợ ra quyết định. Điểm quan tâm có thể là nhà hàng, khách sạn, quán cà phê, điểm tham quan, công viên, khu mua sắm hoặc các dịch vụ liên quan đến hành trình du lịch (Borràs et al., 2014; Zhang et al., 2023).

Đặc điểm quan trọng của dữ liệu điểm quan tâm là tính không đồng nhất. Dữ liệu có thể đến từ bản đồ mở, dịch vụ thương mại hoặc hệ thống nội bộ. Mỗi nguồn thường có cách biểu diễn khác nhau về tên địa điểm, địa chỉ, tọa độ, danh mục, đánh giá và thông tin liên hệ. Vì vậy, bài toán không chỉ dừng lại ở việc thu thập dữ liệu, mà còn cần chuẩn hóa, làm giàu, đánh giá chất lượng và cung cấp dữ liệu đã đủ tin cậy cho người dùng cuối. W3C cũng xem metadata, provenance, chất lượng, phiên bản và API là các thực hành quan trọng khi công bố hoặc tiêu thụ dữ liệu trên web (W3C, 2017).

Về mặt lý thuyết, dự án thuộc nhóm nền tảng tích hợp dữ liệu nhiều nguồn. Hướng tiếp cận này có ưu điểm là tạo ra một nguồn dữ liệu tập trung, giúp giảm tình trạng mỗi chức năng sử dụng một tập dữ liệu riêng. Tuy nhiên, nhược điểm là hệ thống phải giải quyết các vấn đề về trùng lặp, thiếu dữ liệu, sai khác định dạng và độ tin cậy không đồng đều giữa các nguồn (W3C, 2017; IBM, n.d.-a).

Trong bối cảnh dự án, cách tiếp cận phù hợp là xây dựng một pipeline dữ liệu có kiểm soát. Dữ liệu được thu thập từ nguồn mở và nguồn thương mại, sau đó đi qua các bước chuẩn hóa, đánh giá chất lượng và phân loại trước khi phục vụ cho dashboard hoặc giao diện lập trình ứng dụng (IBM, n.d.-g; IBM, n.d.-b; W3C, 2017).

### 1.2. Quy trình trích xuất, biến đổi và nạp dữ liệu

Quy trình trích xuất, biến đổi và nạp dữ liệu là một mô hình phổ biến trong các hệ thống tích hợp dữ liệu. Theo IBM, quy trình này kết hợp, làm sạch và tổ chức dữ liệu từ nhiều nguồn thành một tập dữ liệu nhất quán để lưu vào kho dữ liệu, hồ dữ liệu hoặc hệ thống đích khác (IBM, n.d.-g).

Ba giai đoạn chính gồm (IBM, n.d.-g):

- Trích xuất dữ liệu từ nguồn.
- Biến đổi dữ liệu thông qua làm sạch, chuẩn hóa, kết hợp và kiểm tra.
- Nạp dữ liệu đã xử lý vào hệ thống lưu trữ hoặc phục vụ.

Ưu điểm của mô hình này là quy trình rõ ràng, dễ kiểm soát và phù hợp với các hệ thống cần xử lý dữ liệu theo chu kỳ. Nhược điểm là dữ liệu thường không được cập nhật tức thời, vì kết quả chỉ xuất hiện sau khi quá trình xử lý hoàn tất (IBM, n.d.-g; Google Cloud, n.d.-a).

Dự án sử dụng hướng tiếp cận này vì dữ liệu điểm du lịch không yêu cầu tính thời gian thực tuyệt đối. Việc cập nhật theo đợt hoặc theo lịch là đủ để phục vụ phân tích, báo cáo và quản trị. So với xử lý dòng thời gian thực, cách tiếp cận này đơn giản hơn, dễ vận hành hơn và phù hợp hơn với quy mô hiện tại của dự án (Google Cloud, n.d.-a; Amazon Web Services, n.d.; Apache Airflow, n.d.).

### 1.3. Xử lý theo lô và xử lý dòng

Xử lý theo lô là phương pháp gom dữ liệu thành từng nhóm để xử lý theo lịch hoặc theo yêu cầu. Xử lý dòng là phương pháp xử lý dữ liệu liên tục ngay khi dữ liệu phát sinh. Google Cloud Dataflow mô tả một nền tảng có thể xử lý cả batch và streaming, cho thấy đây là hai mô hình xử lý dữ liệu phổ biến nhưng phục vụ nhu cầu độ trễ khác nhau (Google Cloud, n.d.-a). AWS cũng phân biệt streaming data như dữ liệu được tạo liên tục, thường cần xử lý gần thời gian thực (Amazon Web Services, n.d.).

Xử lý dòng có ưu điểm là độ trễ thấp, phù hợp với các bài toán như giao dịch tài chính, dữ liệu cảm biến, giám sát hệ thống hoặc sự kiện người dùng thời gian thực. Tuy nhiên, xử lý dòng thường cần thêm các thành phần như hàng đợi thông điệp, cơ chế checkpoint, retry, giám sát độ trễ và xử lý lỗi phức tạp (Amazon Web Services, n.d.; Apache Kafka, n.d.; Kreps et al., 2011).

Xử lý theo lô có ưu điểm là đơn giản hơn, dễ kiểm soát hơn và phù hợp với dữ liệu có tốc độ thay đổi không quá cao. Nhược điểm là dữ liệu không phản ánh thay đổi ngay lập tức (IBM, n.d.-g; Google Cloud, n.d.-a; Apache Airflow, n.d.).

Đối với dữ liệu điểm du lịch, tần suất thay đổi thường không cao như dữ liệu thời gian thực. Vì vậy, dự án ưu tiên xử lý theo lô để giảm độ phức tạp vận hành, đồng thời vẫn đảm bảo khả năng cập nhật dữ liệu định kỳ (Google Cloud, n.d.-a; Amazon Web Services, n.d.; Borràs et al., 2014).

### 1.4. Kiến trúc dữ liệu nhiều lớp

Kiến trúc dữ liệu nhiều lớp, thường được biết đến với ba lớp đồng, bạc và vàng, là một cách tổ chức dữ liệu theo mức độ xử lý và độ tin cậy tăng dần. Databricks mô tả cách tiếp cận này như một phương pháp nhiều lớp để xây dựng nguồn dữ liệu đáng tin cậy, trong đó dữ liệu được tinh chỉnh dần qua các lớp (Databricks, n.d.).

Lớp đầu tiên lưu dữ liệu thô, gần với dữ liệu nguồn ban đầu. Lớp tiếp theo lưu dữ liệu đã được làm sạch, chuẩn hóa và kết hợp. Lớp cuối cùng lưu dữ liệu đã sẵn sàng phục vụ nghiệp vụ, báo cáo hoặc ứng dụng (Databricks, n.d.; IBM, n.d.-a).

Ưu điểm của kiến trúc này là bảo toàn dữ liệu gốc, tách biệt rõ ràng giữa dữ liệu thô và dữ liệu đã xử lý, đồng thời hỗ trợ tái xử lý khi quy tắc nghiệp vụ thay đổi. Kiến trúc này cũng giúp tăng khả năng kiểm soát chất lượng và truy vết dữ liệu (Databricks, n.d.; IBM, n.d.-f; W3C, 2013).

Nhược điểm là hệ thống phải quản lý nhiều lớp dữ liệu hơn, dễ phát sinh chi phí lưu trữ và yêu cầu kiểm soát đồng bộ giữa các lớp. Nếu không có quy tắc rõ ràng, dữ liệu giữa các lớp có thể bị lệch hoặc khó giải thích (Databricks, n.d.; IBM, n.d.-a; DAMA International, n.d.).

Dự án chọn kiến trúc nhiều lớp vì dữ liệu điểm quan tâm đến từ nhiều nguồn và có chất lượng không đồng đều. Việc tách dữ liệu thành các mức độ tin cậy khác nhau giúp hệ thống vừa giữ được dữ liệu gốc, vừa cung cấp được dữ liệu đầu ra đã qua kiểm soát (Databricks, n.d.; IBM, n.d.-b; Yeboah et al., 2021).

### 1.5. Chất lượng dữ liệu và chấm điểm chất lượng

Chất lượng dữ liệu là một yếu tố quan trọng trong các nền tảng dữ liệu. Dữ liệu sai, thiếu hoặc không nhất quán có thể dẫn đến báo cáo sai, gợi ý không chính xác và quyết định nghiệp vụ kém tin cậy. IBM nêu các chiều chất lượng dữ liệu phổ biến gồm accuracy, completeness, consistency, timeliness, validity và uniqueness (IBM, n.d.-b). Chuẩn ISO/IEC 25012 cũng đưa ra mô hình chất lượng dữ liệu cho dữ liệu có cấu trúc trong hệ thống máy tính, với các đặc tính chất lượng nhìn từ góc độ nội tại và phụ thuộc hệ thống (ISO, 2008).

Với dữ liệu điểm quan tâm, các vấn đề thường gặp gồm thiếu tọa độ, thiếu tên, thiếu địa chỉ, sai danh mục, thiếu thông tin liên hệ hoặc trùng lặp giữa các nguồn. Do đó, hệ thống cần có cơ chế đánh giá mức độ sẵn sàng sử dụng của từng bản ghi (IBM, n.d.-b; Barron et al., 2014; Yeboah et al., 2021).

Một cách tiếp cận phù hợp là chấm điểm chất lượng dựa trên các tiêu chí như độ đầy đủ, tính hợp lệ, sự tồn tại của nguồn bổ sung và khả năng phục vụ người dùng cuối. Cơ chế này giúp tự động phân loại dữ liệu: bản ghi đủ tốt được đưa vào lớp phục vụ, bản ghi chưa chắc chắn cần được xem xét thêm, còn bản ghi lỗi bị loại khỏi đầu ra chính (IBM, n.d.-b; ISO, 2008).

Ưu điểm của chấm điểm chất lượng là giảm khối lượng kiểm tra thủ công và tạo ra quy tắc đánh giá nhất quán. Nhược điểm là điểm số phụ thuộc vào công thức được thiết kế. Nếu công thức chưa phù hợp, một số bản ghi có thể bị đánh giá quá cao hoặc quá thấp (IBM, n.d.-b; ISO, 2008; DAMA International, n.d.).

Dự án khắc phục bằng cách không chỉ dựa vào một ngưỡng tự động duy nhất. Các bản ghi trung gian có thể được đưa vào vùng chờ xem xét, giúp kết hợp giữa tự động hóa và can thiệp của con người khi cần (IBM, n.d.-b; DAMA International, n.d.).

### 1.6. Truy vết dữ liệu

Truy vết dữ liệu là khả năng xác định nguồn gốc và quá trình biến đổi của dữ liệu. Trong các hệ thống nhiều lớp, truy vết dữ liệu giúp biết một bản ghi đầu ra được tạo ra từ bản ghi nguồn nào, qua các bước xử lý nào và tại thời điểm nào. Theo IBM, data lineage giúp theo dõi dòng di chuyển, biến đổi và sử dụng của dữ liệu trong hệ thống (IBM, n.d.-f). W3C PROV cung cấp một mô hình chuẩn để trao đổi thông tin provenance trên môi trường web và các hệ thống dị thể (W3C, 2013).

Ưu điểm của truy vết dữ liệu là hỗ trợ kiểm tra, giải thích và xử lý lỗi. Khi dữ liệu đầu ra có vấn đề, hệ thống có thể truy ngược về dữ liệu gốc hoặc bước xử lý liên quan. Điều này đặc biệt quan trọng với các hệ thống có nhiều lớp xử lý và nhiều nguồn dữ liệu (IBM, n.d.-f; W3C, 2013).

Nhược điểm là cần lưu thêm thông tin định danh và metadata, làm tăng độ phức tạp của mô hình dữ liệu. Tuy nhiên, với một nền tảng dữ liệu cần đảm bảo độ tin cậy, lợi ích của truy vết dữ liệu lớn hơn chi phí phát sinh (IBM, n.d.-f; W3C, 2013; DAMA International, n.d.).

Dự án áp dụng tư duy truy vết thông qua khóa định danh xuyên suốt các lớp dữ liệu. Điều này giúp dữ liệu đã phục vụ cho người dùng vẫn có thể liên hệ ngược về dữ liệu thô ban đầu (IBM, n.d.-f; W3C, 2013).

### 1.7. Định hướng giao diện lập trình ứng dụng

Sau khi dữ liệu đã được xử lý, hệ thống cần một cơ chế ổn định để cung cấp dữ liệu cho dashboard hoặc ứng dụng bên ngoài. Cách tiếp cận đặt giao diện lập trình ứng dụng làm trung tâm giúp tách biệt lớp giao diện, lớp xử lý dữ liệu và lớp lưu trữ (OpenAPI Initiative, n.d.; Fielding, 2000).

Ưu điểm của cách tiếp cận này là frontend không cần truy cập trực tiếp cơ sở dữ liệu, giúp tăng tính bảo mật và kiểm soát logic nghiệp vụ. Ngoài ra, các ứng dụng khác cũng có thể tái sử dụng dữ liệu thông qua cùng một giao diện (OpenAPI Initiative, n.d.; OWASP, n.d.).

REST là một lựa chọn phù hợp khi các nhóm endpoint đã tương đối rõ ràng, ví dụ danh sách điểm quan tâm, thống kê dashboard, danh sách thành phố hoặc trạng thái pipeline. Trong luận án của Roy Fielding, REST được giới thiệu như một phong cách kiến trúc cho hệ thống phần mềm mạng và là một nền tảng quan trọng của kiến trúc web hiện đại (Fielding, 2000). So với GraphQL, REST ít linh hoạt hơn trong việc cho phép client tự chọn cấu trúc dữ liệu, nhưng đơn giản hơn, dễ triển khai hơn và dễ phù hợp với các màn hình dashboard cố định.

Trong dự án, REST phù hợp hơn GraphQL vì bài toán chủ yếu là phục vụ các tập dữ liệu đã được xác định trước. Việc chọn REST giúp giảm độ phức tạp, đồng thời vẫn đáp ứng tốt nhu cầu của dashboard và các API consumer cơ bản (OpenAPI Initiative, n.d.; Fielding, 2000).

### 1.8. Quản trị dữ liệu

Quản trị dữ liệu là tập hợp nguyên tắc, vai trò, chính sách và quy trình nhằm bảo đảm dữ liệu được thu thập, lưu trữ, xử lý, chia sẻ và sử dụng một cách có kiểm soát. IBM mô tả quản trị dữ liệu là lĩnh vực tập trung vào chất lượng, bảo mật và khả năng sẵn sàng của dữ liệu trong tổ chức (IBM, n.d.-e). DAMA-DMBOK là một khung tri thức được sử dụng rộng rãi trong quản lý dữ liệu, cung cấp cách nhìn có cấu trúc về các lĩnh vực như data governance, data architecture, metadata, data quality và data security (DAMA International, n.d.).

Ưu điểm của quản trị dữ liệu là làm rõ trách nhiệm sở hữu dữ liệu, giảm rủi ro dùng sai dữ liệu và giúp hệ thống dễ kiểm tra hơn. Nhược điểm là nếu áp dụng quá nặng, quy trình có thể làm chậm thay đổi và tăng chi phí vận hành (IBM, n.d.-e; Google Cloud, n.d.-b; DAMA International, n.d.).

Dự án phù hợp với mô hình quản trị dữ liệu tập trung vì quy mô hiện tại chưa cần phân quyền sở hữu phức tạp theo nhiều phòng ban. Các khái niệm như Data Owner, Data Steward, Data Consumer, phân loại dữ liệu và chính sách chia sẻ giúp bảo đảm Gold layer là nguồn dữ liệu chính thức, trong khi Bronze/Silver vẫn được kiểm soát như dữ liệu nội bộ. Cách tiếp cận này cũng tương thích với các nguyên tắc FAIR, trong đó dữ liệu nên dễ tìm, dễ truy cập, có khả năng liên thông và có thể tái sử dụng (Wilkinson et al., 2016).

### 1.9. Quản lý dữ liệu chủ và bản ghi chuẩn

Quản lý dữ liệu chủ là hướng tiếp cận tạo ra một bản ghi đại diện đáng tin cậy cho một thực thể nghiệp vụ quan trọng. IBM mô tả Master Data Management là cách tạo ra một "golden record", tức một nguồn sự thật duy nhất được tích hợp từ nhiều nguồn dữ liệu (IBM, n.d.-h). Trong dự án, thực thể nghiệp vụ chính là điểm quan tâm du lịch. Một địa điểm có thể xuất hiện ở nhiều nguồn khác nhau, có tên gần giống nhau, tọa độ gần nhau hoặc thiếu một phần thông tin.

Ưu điểm của quản lý dữ liệu chủ là giảm trùng lặp và tạo ra một nguồn sự thật thống nhất cho các chức năng phân tích, báo cáo và giao diện lập trình ứng dụng. Nhược điểm là việc hợp nhất thực thể không đơn giản, đặc biệt khi tên địa điểm ngắn, viết tắt, khác dấu tiếng Việt hoặc dữ liệu nguồn không đầy đủ (IBM, n.d.-h; Barron et al., 2014).

Dự án xử lý vấn đề này bằng cách dùng Gold layer như tập bản ghi chuẩn. Các bản ghi được hợp nhất, chấm điểm và chỉ những bản ghi đạt ngưỡng chất lượng mới được đưa vào lớp phục vụ. Cách này phù hợp hơn việc để từng màn hình tự xử lý trùng lặp, vì logic hợp nhất được tập trung ở pipeline dữ liệu (Databricks, n.d.; IBM, n.d.-b; IBM, n.d.-h).

### 1.10. Hợp đồng dữ liệu và tiến hóa lược đồ

Hợp đồng dữ liệu là thỏa thuận giữa bên tạo dữ liệu và bên sử dụng dữ liệu về cấu trúc, ý nghĩa, kiểu dữ liệu và kỳ vọng chất lượng. Trong hệ thống có nhiều lớp dữ liệu và nhiều thành phần tiêu thụ, hợp đồng dữ liệu giúp tránh tình trạng backend thay đổi field nhưng frontend, báo cáo hoặc API consumer không được cập nhật kịp. Với lớp API, OpenAPI phù hợp để đóng vai trò đặc tả hợp đồng vì mô tả endpoint, schema, request và response theo định dạng có thể đọc bởi con người và công cụ (OpenAPI Initiative, n.d.).

Ưu điểm của hợp đồng dữ liệu là tăng tính ổn định của hệ thống, hỗ trợ kiểm thử tự động và làm rõ trách nhiệm khi schema thay đổi. Nhược điểm là cần duy trì tài liệu, versioning và quy trình thay đổi. Nếu hợp đồng dữ liệu không được cập nhật cùng code, nó có thể trở thành tài liệu lỗi thời (OpenAPI Initiative, n.d.; Orval, n.d.; DAMA International, n.d.).

Dự án dùng hướng tiếp cận phù hợp với quy mô hiện tại: OpenAPI đóng vai trò hợp đồng cho API, các quy chuẩn layer định nghĩa field bắt buộc, còn chính sách tiến hóa lược đồ ưu tiên thay đổi tương thích ngược. Cách này giảm rủi ro vỡ giao diện và giúp quá trình mở rộng dữ liệu thành phố, danh mục hoặc trường thông tin mới dễ kiểm soát hơn (OpenAPI Initiative, n.d.; Orval, n.d.).

### 1.11. Quan sát dữ liệu và mục tiêu mức dịch vụ

Quan sát dữ liệu là khả năng theo dõi trạng thái, độ tươi mới, chất lượng, lỗi và luồng xử lý của dữ liệu. Với nền tảng dữ liệu, việc hệ thống vẫn chạy không đồng nghĩa với dữ liệu đầu ra còn đúng hoặc còn mới. Vì vậy, các chỉ số như enrichment rate, gold ratio, quarantine rate, job failure rate và data freshness là cần thiết. Google Cloud cũng xem data governance là cách bảo đảm dữ liệu an toàn, riêng tư, chính xác, sẵn sàng và có thể sử dụng được trong suốt vòng đời dữ liệu (Google Cloud, n.d.-b).

Trong kỹ thuật vận hành hệ thống, Google SRE định nghĩa mục tiêu mức dịch vụ là giá trị mục tiêu hoặc khoảng giá trị mục tiêu được đo bằng chỉ báo mức dịch vụ (Google Site Reliability Engineering, n.d.). Áp dụng vào nền tảng dữ liệu, các mục tiêu này không chỉ là uptime của API mà còn gồm độ tươi mới của Gold layer, tỷ lệ lỗi pipeline và thời gian khôi phục sau sự cố.

Ưu điểm của cách tiếp cận này là giúp đánh giá hệ thống bằng số liệu thay vì cảm tính. Nhược điểm là việc chọn sai chỉ số có thể khiến đội vận hành tối ưu nhầm mục tiêu. Dự án chọn các chỉ số trực tiếp gắn với giá trị dữ liệu như số Gold POIs, tỷ lệ làm giàu, tỷ lệ quarantine và backlog pending review, vì các chỉ số này phản ánh tốt sức khỏe thực tế của pipeline (Google Site Reliability Engineering, n.d.; OpenTelemetry, n.d.; Tableau, n.d.).

### 1.12. Bảo mật, phân quyền và bảo vệ bí mật

Bảo mật trong nền tảng dữ liệu gồm nhiều lớp: kiểm soát truy cập, bảo vệ thông tin xác thực, mã hóa khi truyền dữ liệu, mã hóa khi lưu trữ, kiểm tra đầu vào và quản lý sự cố. NIST mô tả kiểm soát truy cập dựa trên vai trò là mô hình phổ biến để giảm độ phức tạp trong quản lý quyền truy cập (NIST Computer Security Resource Center, n.d.). Với API, OWASP API Security Top 10 nhấn mạnh các rủi ro phổ biến như lỗi phân quyền, xác thực, giới hạn tài nguyên và cấu hình bảo mật (OWASP, n.d.). NIST Cybersecurity Framework cũng tổ chức quản trị rủi ro bảo mật theo các chức năng nhận diện, bảo vệ, phát hiện, phản ứng và khôi phục (NIST, n.d.).

Ưu điểm của phân quyền theo vai trò là dễ hiểu và phù hợp với các nhóm người dùng như quản trị viên, người phân tích, người duyệt dữ liệu và ứng dụng tích hợp. Nhược điểm là khi hệ thống lớn hơn, số lượng vai trò có thể tăng nhanh hoặc không đủ linh hoạt cho các điều kiện truy cập chi tiết (NIST Computer Security Resource Center, n.d.; OWASP, n.d.; NIST, n.d.).

Dự án đang ở quy mô phù hợp để dùng phân quyền đơn giản kết hợp bảo vệ secrets bằng biến môi trường hoặc kho bí mật của nền tảng chạy. Cách này thực tế hơn so với triển khai hệ thống IAM phức tạp, nhưng vẫn đáp ứng nguyên tắc quan trọng: frontend không được giữ khóa bí mật, API key không được commit vào mã nguồn và dữ liệu nội bộ không được chia sẻ như dữ liệu Gold (NIST Computer Security Resource Center, n.d.; OWASP, n.d.; NIST, n.d.).

### 1.13. Tư duy vận hành dữ liệu và triển khai liên tục

Tư duy vận hành dữ liệu kết hợp thực hành kỹ thuật phần mềm với vận hành pipeline dữ liệu. IBM mô tả DataOps là cách tiếp cận nhằm cải thiện tốc độ, chất lượng và độ tin cậy của dữ liệu thông qua tự động hóa, cộng tác và quản trị (IBM, n.d.-d). Mục tiêu là làm cho thay đổi về code, schema, quy tắc chất lượng và job dữ liệu có thể được kiểm tra, triển khai, theo dõi và khôi phục một cách có kiểm soát. OpenTelemetry xem traces, metrics và logs là các tín hiệu quan trọng để quan sát hoạt động của hệ thống (OpenTelemetry, n.d.).

Ưu điểm của cách tiếp cận này là giảm rủi ro khi thay đổi pipeline, tăng khả năng lặp lại và hỗ trợ rollback khi có lỗi dữ liệu. Nhược điểm là cần kỷ luật trong quản lý phiên bản, logging, kiểm thử và tài liệu hóa thay đổi (OpenTelemetry, n.d.; IBM, n.d.-d; Apache Airflow, n.d.).

Dự án áp dụng ở mức vừa phải thông qua quy trình build, kiểm tra kiểu, sinh client từ đặc tả API, ghi log job, lưu trạng thái job và khả năng rebuild Silver/Gold từ Bronze. Cách này phù hợp với nền tảng dữ liệu quy mô nhỏ đến trung bình vì đạt được khả năng kiểm soát cần thiết mà chưa cần hệ thống điều phối phức tạp (Orval, n.d.; OpenTelemetry, n.d.; IBM, n.d.-d).

### 1.14. Phân tích, chỉ số và báo cáo

Dashboard dữ liệu không chỉ là giao diện hiển thị, mà là lớp diễn giải trạng thái hệ thống thành thông tin có thể hành động. Các chỉ số như số lượng điểm quan tâm theo thành phố, phân bố danh mục, chất lượng dữ liệu, tỷ lệ làm giàu và pipeline funnel giúp người dùng hiểu dữ liệu đang phát triển như thế nào. Tableau mô tả KPI dashboard là công cụ tập trung các chỉ số hiệu suất quan trọng để theo dõi, đánh giá và ra quyết định dựa trên dữ liệu (Tableau, n.d.).

Ưu điểm của phân tích bằng chỉ số là dễ theo dõi xu hướng và phát hiện bất thường. Nhược điểm là nếu định nghĩa chỉ số không rõ, các bên có thể hiểu sai cùng một con số. Vì vậy, việc có danh mục KPI và công thức tính rõ ràng là cần thiết (Google Site Reliability Engineering, n.d.; Tableau, n.d.).

Dự án phù hợp với hướng phân tích theo dashboard vì người dùng chính gồm quản trị viên, kỹ sư dữ liệu và nhà phân tích. Các nhóm này cần nắm nhanh trạng thái dữ liệu, chất lượng và pipeline thay vì đọc trực tiếp dữ liệu thô trong cơ sở dữ liệu (OpenTelemetry, n.d.; Tableau, n.d.).

### 1.15. Dữ liệu lớn, kho dữ liệu, hồ dữ liệu và kiến trúc hợp nhất

Dữ liệu lớn thường được gắn với các đặc trưng về khối lượng, tốc độ và sự đa dạng của dữ liệu. NIST cho rằng Big Data tạo ra nhu cầu về các kiến trúc có khả năng mở rộng để xử lý volume, velocity và variety (NIST, 2015). Trong các hệ thống dữ liệu hiện đại, dữ liệu lớn không chỉ là vấn đề dung lượng, mà còn là vấn đề tích hợp nhiều nguồn, nhiều định dạng, nhiều tốc độ cập nhật và nhiều nhu cầu khai thác khác nhau.

Kho dữ liệu là hướng tổ chức dữ liệu đã được làm sạch, chuẩn hóa và tối ưu cho phân tích nghiệp vụ. Hồ dữ liệu tập trung vào lưu trữ dữ liệu thô hoặc bán cấu trúc với chi phí thấp và độ linh hoạt cao. Kiến trúc lakehouse kết hợp ưu điểm của data lake và data warehouse: lưu trữ linh hoạt nhưng vẫn hỗ trợ quản lý dữ liệu và truy vấn phân tích hiệu quả (IBM, n.d.-a).

Ưu điểm của kho dữ liệu là dữ liệu rõ cấu trúc, dễ dùng cho báo cáo và nghiệp vụ. Nhược điểm là kém linh hoạt khi dữ liệu nguồn thay đổi liên tục hoặc dữ liệu thô có cấu trúc không ổn định. Hồ dữ liệu linh hoạt hơn nhưng dễ trở thành "data swamp" nếu thiếu metadata, governance và quality control. Lakehouse giải quyết một phần vấn đề này bằng cách thêm lớp quản lý dữ liệu và metadata trên nền lưu trữ linh hoạt (IBM, n.d.-c).

Dự án không triển khai một lakehouse đầy đủ theo nghĩa công nghiệp như Delta Lake, Iceberg hoặc Hudi, nhưng áp dụng tư duy tương tự ở quy mô nhỏ: Bronze giữ dữ liệu gần nguồn, Silver chuẩn hóa và chấm điểm, Gold là lớp phục vụ. Cách này phù hợp với phạm vi hiện tại vì dữ liệu chủ yếu là document và POI, chưa cần object storage hay distributed table format (Databricks, n.d.; IBM, n.d.-a; IBM, n.d.-c).

### 1.16. Kiến trúc xử lý dữ liệu phân tán

Trong các hệ thống dữ liệu lớn, kiến trúc phân tán thường được dùng để xử lý khối lượng dữ liệu cao, yêu cầu nhiều node xử lý hoặc yêu cầu thời gian thực. Lambda Architecture là một mô hình kết hợp batch layer, speed layer và serving layer nhằm vừa có kết quả gần thời gian thực, vừa có kết quả chính xác từ xử lý theo lô (Ericsson, 2015). Kappa Architecture là một hướng đơn giản hơn, cố gắng xử lý dữ liệu bằng một luồng streaming thống nhất thay vì duy trì hai pipeline batch và streaming riêng biệt (Kreps, 2014).

Một lý thuyết quan trọng khác trong hệ phân tán là định lý CAP. IBM mô tả CAP theorem như sự đánh đổi giữa consistency, availability và partition tolerance trong hệ thống phân tán (IBM, n.d.-i). Bài báo của Gilbert và Lynch đã hình thức hóa Brewer's conjecture và chỉ ra giới hạn của việc đồng thời đạt consistency, availability và partition tolerance trong dịch vụ web phân tán (Gilbert & Lynch, 2002). Điều này có ý nghĩa khi thiết kế hệ thống nhiều node, nhiều bản sao dữ liệu hoặc yêu cầu phục vụ liên tục trong điều kiện mạng lỗi.

Ưu điểm của Lambda là cân bằng được độ chính xác của batch và độ trễ thấp của streaming. Nhược điểm là phải duy trì hai logic xử lý, dễ tăng chi phí vận hành. Kappa đơn giản hơn về kiến trúc nhưng phụ thuộc nhiều vào hạ tầng streaming và khả năng tái xử lý từ log sự kiện. Với dự án hiện tại, dữ liệu điểm du lịch chưa có tốc độ phát sinh cao như giao dịch hoặc cảm biến, nên batch pipeline có kiểm soát là lựa chọn hợp lý hơn (Ericsson, 2015; Kreps, 2014; Apache Kafka, n.d.).

## 2. Cơ sở công nghệ

### 2.1. Cơ sở dữ liệu tài liệu

MongoDB là hệ quản trị cơ sở dữ liệu tài liệu, phù hợp với dữ liệu có cấu trúc linh hoạt. Theo tài liệu MongoDB, mô hình schema linh hoạt cho phép cải tiến mô hình dữ liệu trong quá trình phát triển ứng dụng (MongoDB, n.d.-c). MongoDB cũng cung cấp aggregation pipeline, trong đó dữ liệu đi qua nhiều stage để lọc, nhóm, tính toán hoặc biến đổi kết quả (MongoDB, n.d.-a).

Dữ liệu điểm quan tâm trong dự án có nhiều trường tùy chọn và có thể chứa dữ liệu thô dạng JSON từ các nguồn bên ngoài. Một bản ghi có thể có địa chỉ nhưng không có website, có dữ liệu bản đồ mở nhưng chưa có dữ liệu thương mại, hoặc có các trường metadata khác nhau tùy theo nguồn. Vì vậy, cơ sở dữ liệu tài liệu phù hợp hơn mô hình quan hệ chặt chẽ trong giai đoạn này (MongoDB, n.d.-c; MongoDB, n.d.-a).

Ưu điểm của MongoDB là lưu trữ tốt dữ liệu bán cấu trúc, hỗ trợ index, hỗ trợ truy vấn theo document và có khả năng aggregation. Điều này phù hợp với các nhu cầu như thống kê điểm quan tâm theo thành phố, theo danh mục hoặc phân tích chất lượng dữ liệu. Tài liệu MongoDB cũng nhấn mạnh việc dùng index và bộ lọc có thể cải thiện hiệu năng aggregation trong một số trường hợp (MongoDB, n.d.-b).

Nhược điểm của MongoDB là không mạnh bằng cơ sở dữ liệu quan hệ trong các bài toán giao dịch phức tạp, ràng buộc toàn vẹn nhiều bảng hoặc các phép nối quan hệ sâu. Tuy nhiên, dự án tập trung vào dữ liệu document, dữ liệu thô và thống kê phân tích nhẹ, nên MongoDB là lựa chọn phù hợp (MongoDB, n.d.-c; MongoDB, n.d.-a; MongoDB, n.d.-b).

So với PostgreSQL, MongoDB phù hợp hơn ở phần lưu trữ dữ liệu nguồn linh hoạt và phản hồi JSON thô. PostgreSQL vẫn là lựa chọn tốt cho dữ liệu quan hệ chặt chẽ, nhưng sẽ yêu cầu thiết kế schema phức tạp hơn với bài toán dữ liệu điểm quan tâm nhiều nguồn (MongoDB, n.d.-c; MongoDB, n.d.-a).

### 2.2. Dịch vụ xử lý dữ liệu phía máy chủ

Python là ngôn ngữ phổ biến trong xử lý dữ liệu nhờ cú pháp rõ ràng và hệ sinh thái thư viện phong phú. Python.org mô tả Python được dùng trong nhiều miền ứng dụng, trong đó có web development, xử lý dữ liệu, testing và tự động hóa (Python Software Foundation, n.d.). FastAPI là framework Python hiện đại để xây dựng dịch vụ web. Tài liệu FastAPI nhấn mạnh các đặc điểm như sử dụng type annotation, tích hợp Pydantic và sinh tài liệu theo chuẩn OpenAPI (FastAPI, n.d.).

Dự án sử dụng Python cho phần xử lý dữ liệu vì các tác vụ như thu thập, chuẩn hóa, làm giàu và chấm điểm dữ liệu phù hợp với cách viết logic của Python. FastAPI giúp biến phần xử lý dữ liệu thành một service có thể được điều khiển qua API, thay vì chỉ là các script rời rạc (FastAPI, n.d.; Python Software Foundation, n.d.).

Ưu điểm của FastAPI là nhẹ, rõ ràng, hỗ trợ validation tốt và phù hợp với kiến trúc service. So với Flask, FastAPI có lợi thế về type hint và tài liệu tự động. So với Django, FastAPI gọn hơn và phù hợp hơn với service xử lý dữ liệu không cần đầy đủ chức năng của một framework web nguyên khối (FastAPI, n.d.; Pydantic, n.d.-b; Pydantic, n.d.-a).

Nhược điểm của FastAPI là không cung cấp sẵn nhiều thành phần quản trị như Django. Tuy nhiên, dự án không cần một hệ thống web nguyên khối mà cần một service xử lý dữ liệu rõ trách nhiệm, nên FastAPI là lựa chọn hợp lý (FastAPI, n.d.; Uvicorn, n.d.).

### 2.3. Máy chủ cung cấp giao diện lập trình ứng dụng

Node.js và Express được sử dụng cho lớp API trung gian. Node.js tự mô tả là runtime JavaScript bất đồng bộ, hướng sự kiện, được thiết kế để xây dựng ứng dụng mạng có khả năng mở rộng (OpenJS Foundation, n.d.). Express là một framework phổ biến trong hệ sinh thái Node.js. MDN mô tả Express là framework Node.js phổ biến và là nền tảng cho nhiều framework khác (MDN Web Docs, n.d.). Tài liệu Express cũng mô tả Express là framework tối giản, linh hoạt cho ứng dụng web và mobile trên Node.js (Express, n.d.).

Lớp API trung gian phù hợp với dự án vì nó tách frontend khỏi cơ sở dữ liệu và dịch vụ xử lý dữ liệu. API Server chịu trách nhiệm cung cấp dữ liệu đã chuẩn hóa cho dashboard, đồng thời đóng vai trò cổng giao tiếp với dịch vụ xử lý dữ liệu (MDN Web Docs, n.d.; OpenAPI Initiative, n.d.; Express, n.d.).

Ưu điểm của Express là đơn giản, nhẹ và dễ tổ chức route. Khi kết hợp với TypeScript, hệ thống có thêm kiểm tra kiểu tĩnh, giúp giảm lỗi khi phát triển API (TypeScript, n.d.; OpenJS Foundation, n.d.; Express, n.d.).

So với NestJS, Express ít cấu trúc hơn nhưng đơn giản và nhanh triển khai hơn. NestJS phù hợp với hệ thống lớn cần kiến trúc module, dependency injection và quy ước chặt chẽ. Với quy mô dự án hiện tại, Express đáp ứng đủ nhu cầu mà không làm tăng độ phức tạp không cần thiết (MDN Web Docs, n.d.; Express, n.d.).

### 2.4. Giao diện người dùng dạng thành phần

React là thư viện xây dựng giao diện người dùng theo mô hình thành phần. Tài liệu React mô tả React cho phép xây dựng giao diện từ các thành phần riêng lẻ (React, n.d.-a). React cũng nhấn mạnh việc kết hợp markup, CSS và JavaScript thành các component có thể tái sử dụng (React, n.d.-b). Điều này phù hợp với dashboard có nhiều màn hình, nhiều biểu đồ và nhiều khối thông tin có thể tái sử dụng.

Ưu điểm của React là hệ sinh thái lớn, mô hình component rõ ràng và phù hợp với ứng dụng một trang. Khi kết hợp với TypeScript, frontend có thêm kiểm tra kiểu dữ liệu, đặc biệt hữu ích khi giao tiếp với nhiều API (React, n.d.-a; TypeScript, n.d.; React, n.d.-b).

Vite được sử dụng làm công cụ phát triển và build frontend. Theo tài liệu Vite, công cụ này hướng tới trải nghiệm phát triển nhanh và gọn cho các dự án web hiện đại (Vite, n.d.-a). Vite giải quyết các vấn đề thường gặp của công cụ build truyền thống như khởi động dev server chậm và cập nhật nóng chậm trong dự án lớn (Vite, n.d.-b).

So với Next.js, React kết hợp Vite phù hợp hơn với dự án vì dashboard chủ yếu là ứng dụng nội bộ, không yêu cầu tối ưu tìm kiếm hoặc render phía máy chủ. Next.js có ưu thế với ứng dụng public-facing cần SEO hoặc server-side rendering, nhưng sẽ làm tăng độ phức tạp không cần thiết cho dashboard dữ liệu (React, n.d.-a; Vite, n.d.-a; Vite, n.d.-b).

### 2.5. Quản lý trạng thái dữ liệu phía giao diện

Dashboard cần gọi nhiều API khác nhau và phải xử lý trạng thái tải, lỗi, làm mới và cache dữ liệu. TanStack Query được thiết kế cho quản lý server state, bao gồm fetching, caching, synchronizing và updating dữ liệu trên ứng dụng web (TanStack, n.d.).

Ưu điểm của TanStack Query là giảm boilerplate khi gọi API, hỗ trợ cache và làm mới dữ liệu theo query key. Điều này phù hợp với dashboard cần cập nhật số liệu pipeline, danh sách job, biểu đồ và báo cáo (TanStack, n.d.; Tableau, n.d.).

Nhược điểm là cần quản lý query key và cache invalidation cẩn thận. Nếu thiết kế không tốt, giao diện có thể hiển thị dữ liệu cũ. Tuy nhiên, với dashboard nhiều API, lợi ích của TanStack Query lớn hơn độ phức tạp bổ sung (TanStack, n.d.).

### 2.6. Đặc tả giao diện lập trình ứng dụng và kiểm tra dữ liệu

OpenAPI là chuẩn mô tả API theo dạng có thể đọc bởi cả con người và công cụ. Tài liệu OpenAPI nhấn mạnh rằng đặc tả này là nguồn mô tả chính thức cho API và có thể dùng cho tài liệu, sinh mã và kiểm thử (OpenAPI Initiative, n.d.).

Zod là thư viện validation theo hướng TypeScript, hỗ trợ suy luận kiểu tĩnh từ schema (Zod, n.d.). Khi kết hợp OpenAPI, Zod và code generation, hệ thống giảm rủi ro sai lệch giữa backend và frontend.

Ưu điểm của cách tiếp cận này là tăng tính nhất quán của API contract. Frontend có thể dùng client được sinh tự động, backend có thể validate response hoặc schema theo cùng một nguồn định nghĩa (OpenAPI Initiative, n.d.; Zod, n.d.; Orval, n.d.).

Nhược điểm là cần duy trì đặc tả API chính xác. Nếu tài liệu API không được cập nhật cùng code, generated code có thể lệch với thực tế. Tuy nhiên, với hệ thống nhiều endpoint, việc dùng đặc tả API làm nguồn tham chiếu vẫn phù hợp hơn viết thủ công từng type và client (OpenAPI Initiative, n.d.; Orval, n.d.).

### 2.7. Đóng gói và vận hành bằng vùng chứa

Docker giúp đóng gói ứng dụng cùng môi trường chạy, từ đó giảm khác biệt giữa máy phát triển và môi trường triển khai. Theo tài liệu Docker, container là môi trường cô lập tương đối nhẹ, chứa những thành phần cần thiết để chạy ứng dụng và giảm phụ thuộc vào phần mềm cài trên host (Docker, n.d.-c). Docker Compose là công cụ để định nghĩa và chạy ứng dụng nhiều container (Docker, n.d.-a). Tài liệu Docker cũng giải thích rằng khi số lượng container tăng, việc dùng một tệp cấu hình để mô tả toàn bộ ứng dụng giúp quản lý dễ hơn so với chạy từng container thủ công (Docker, n.d.-b).

Dự án có nhiều thành phần: frontend, API, dịch vụ xử lý dữ liệu và cơ sở dữ liệu. Vì vậy, Docker Compose phù hợp để mô tả và chạy toàn bộ hệ thống như một stack thống nhất (Docker, n.d.-a; Docker, n.d.-b; Docker, n.d.-c).

Ưu điểm của Docker là tính nhất quán môi trường, dễ khởi động lại và dễ chia sẻ cách chạy dự án. Nhược điểm là người vận hành cần hiểu khái niệm image, container, network, volume và log. Ngoài ra, quá trình build có thể mất thời gian nếu chưa có cache (Docker, n.d.-a; Docker, n.d.-b; Docker, n.d.-c).

Dự án chọn Docker Compose thay vì Kubernetes vì quy mô hiện tại chưa cần orchestration phức tạp. Kubernetes phù hợp với hệ thống production lớn, cần autoscaling, rolling update, service discovery và quản lý cụm. Với dự án quy mô nhỏ đến trung bình, Docker Compose đơn giản và phù hợp hơn (Docker, n.d.-a; Docker, n.d.-b; Docker, n.d.-c).

### 2.8. Nguồn dữ liệu bản đồ mở và dữ liệu thương mại

OpenStreetMap là nguồn dữ liệu bản đồ mở, phù hợp để thu thập thông tin địa điểm theo vùng và theo thẻ phân loại. Overpass API cho phép truy vấn dữ liệu OpenStreetMap bằng ngôn ngữ truy vấn có cấu trúc (Overpass API, n.d.).

Ưu điểm của dữ liệu bản đồ mở là miễn phí, linh hoạt và có độ phủ rộng. Nhược điểm là mức độ đầy đủ không đồng đều; nhiều điểm có thể thiếu địa chỉ, số điện thoại, website hoặc đánh giá (Overpass API, n.d.; Barron et al., 2014; Yeboah et al., 2021).

Google Places thông qua RapidAPI được sử dụng như nguồn bổ sung. RapidAPI cung cấp nền tảng tra cứu, tài liệu endpoint và cách sử dụng API cho lập trình viên (RapidAPI, n.d.). Nguồn thương mại thường có ưu điểm ở dữ liệu giàu hơn, đặc biệt là rating, review, địa chỉ và thông tin liên hệ. Nhược điểm là phụ thuộc khóa API, quota và chi phí sử dụng.

Dự án kết hợp hai nhóm nguồn dữ liệu để cân bằng giữa độ phủ và độ đầy đủ. Dữ liệu bản đồ mở đóng vai trò nguồn nền, còn nguồn thương mại giúp làm giàu dữ liệu và cải thiện chất lượng đầu ra (Overpass API, n.d.; RapidAPI, n.d.; Barron et al., 2014).

### 2.9. Lập lịch tự động

Các hệ thống xử lý dữ liệu thường cần chạy job theo lịch, ví dụ hằng ngày hoặc theo chu kỳ nhất định. APScheduler là thư viện Python cho phép lập lịch thực thi mã Python một lần hoặc định kỳ (Python Package Index, n.d.).

Ưu điểm của lập lịch trong ứng dụng là đơn giản, dễ tích hợp và phù hợp với hệ thống quy mô vừa. Nhược điểm là khi hệ thống mở rộng lớn hơn, việc chạy job trong tiến trình ứng dụng có thể gặp hạn chế về phân tán tải, retry và khả năng chịu lỗi (Python Package Index, n.d.; Apache Airflow, n.d.).

Dự án sử dụng lập lịch ở mức vừa phải vì nhu cầu hiện tại là chạy các job định kỳ như đồng bộ hoặc làm giàu dữ liệu. Với quy mô hiện tại, cách này đơn giản hơn so với việc triển khai hệ thống hàng đợi hoặc orchestration chuyên dụng (Python Package Index, n.d.; Apache Airflow, n.d.; Apache Kafka, n.d.).

### 2.10. Kiểm tra dữ liệu phía dịch vụ xử lý

Pydantic là thư viện kiểm tra dữ liệu phổ biến trong hệ sinh thái Python, dựa nhiều vào type hints để định nghĩa model và validation (Pydantic, n.d.-b). Pydantic cũng hỗ trợ tạo JSON Schema từ model, tương thích với JSON Schema và các mở rộng OpenAPI (Pydantic, n.d.-a). Trong dự án, Pydantic phù hợp với các API nhận yêu cầu tạo job, cập nhật lịch chạy, cấu hình thành phố hoặc duyệt dữ liệu.

Ưu điểm của Pydantic là giúp phát hiện sai kiểu dữ liệu sớm, làm rõ cấu trúc request và tích hợp tốt với FastAPI. Nhược điểm là validation runtime có thể tạo thêm chi phí xử lý, và model cần được cập nhật khi schema thay đổi. Khả năng sinh JSON Schema giúp giảm khoảng cách giữa validation runtime và tài liệu API, nhưng vẫn yêu cầu quản lý schema cẩn thận khi nghiệp vụ thay đổi (Pydantic, n.d.-a).

Dự án dùng Pydantic ở biên dịch vụ thay vì chỉ kiểm tra thủ công trong từng hàm. Cách này phù hợp vì dữ liệu đi vào pipeline có ảnh hưởng trực tiếp đến trạng thái job và chất lượng đầu ra (Pydantic, n.d.-b; Pydantic, n.d.-a).

### 2.11. Máy chủ bất đồng bộ cho dịch vụ xử lý

Uvicorn là máy chủ web theo chuẩn ASGI cho Python (Uvicorn, n.d.). Tài liệu Uvicorn nhấn mạnh ASGI tách biệt framework ứng dụng khỏi phần máy chủ, đồng thời hỗ trợ mô hình bất đồng bộ phù hợp với các tác vụ chờ mạng như gọi API bên ngoài hoặc truy cập cơ sở dữ liệu (Uvicorn, n.d.).

Ưu điểm của Uvicorn là nhẹ, phù hợp với FastAPI và thuận tiện khi đóng gói service. Nhược điểm là bản thân Uvicorn chỉ là lớp server, không thay thế các cơ chế production nâng cao như cân bằng tải, giám sát hoặc autoscaling (Uvicorn, n.d.).

Dự án chọn Uvicorn vì ETL service cần một HTTP service gọn để nhận lệnh job và trả trạng thái. So với việc chỉ chạy script, cách này dễ tích hợp với API Server và dashboard hơn (FastAPI, n.d.; Uvicorn, n.d.).

### 2.12. Kiểu tĩnh trong phát triển giao diện và máy chủ

TypeScript bổ sung hệ thống kiểu cho JavaScript, giúp mô tả cấu trúc dữ liệu rõ ràng hơn trong quá trình phát triển. Tài liệu TypeScript cho thấy ngôn ngữ này hỗ trợ các kiểu dữ liệu cơ bản và mở rộng trên nền JavaScript (TypeScript, n.d.). Zod bổ sung thêm validation runtime theo hướng TypeScript-first, giúp schema có thể vừa kiểm tra dữ liệu lúc chạy vừa suy luận kiểu tĩnh (Zod, n.d.).

Ưu điểm của TypeScript là phát hiện nhiều lỗi trước khi chạy, đặc biệt khi frontend và backend trao đổi nhiều cấu trúc JSON. Nhược điểm là tăng thêm bước build, cấu hình và yêu cầu định nghĩa type nhất quán (TypeScript, n.d.; Zod, n.d.).

Dự án dùng TypeScript cho dashboard, API Server và các thư viện chia sẻ vì API contract, schema và dữ liệu dashboard cần được kiểm soát chặt. So với JavaScript thuần, TypeScript phù hợp hơn với hệ thống có nhiều endpoint và nhiều kiểu dữ liệu nghiệp vụ (OpenAPI Initiative, n.d.; Zod, n.d.; TypeScript, n.d.).

### 2.13. Hệ thống giao diện, thành phần và trực quan hóa

Tailwind CSS là framework theo hướng utility-first, cho phép xây dựng giao diện bằng các lớp tiện ích có sẵn (Tailwind CSS, n.d.-a). Tài liệu Tailwind mô tả cách xây dựng giao diện bằng cách kết hợp các utility class trực tiếp trong markup (Tailwind CSS, n.d.-b). Radix UI cung cấp các primitive giao diện chú trọng khả năng truy cập và tuân theo các mẫu WAI-ARIA (Radix UI, n.d.). Recharts là thư viện biểu đồ dạng component cho React (Recharts, n.d.).

Ưu điểm của nhóm công nghệ này là giúp xây dựng dashboard nhanh, nhất quán và dễ tái sử dụng. Tailwind giúp kiểm soát giao diện mà không cần viết nhiều CSS riêng; Radix giúp giảm rủi ro sai về accessibility ở các thành phần như dialog, dropdown, tab; Recharts phù hợp với các biểu đồ pipeline, phân bố và KPI (Tailwind CSS, n.d.-a; Radix UI, n.d.; Recharts, n.d.; Tailwind CSS, n.d.-b).

Nhược điểm là hệ thống có nhiều thư viện frontend, cần quản lý dependency và quy ước thiết kế để tránh giao diện thiếu nhất quán. Dự án chấp nhận đánh đổi này vì dashboard cần nhiều bảng, bộ lọc, biểu đồ và thành phần tương tác, trong khi việc tự xây dựng toàn bộ từ đầu sẽ tốn thời gian và dễ phát sinh lỗi giao diện (Tailwind CSS, n.d.-a; Radix UI, n.d.; Recharts, n.d.).

### 2.14. Không gian làm việc chung và sinh mã từ đặc tả

pnpm workspace hỗ trợ quản lý nhiều package trong cùng một repository và cho phép các package nội bộ phụ thuộc lẫn nhau (pnpm, n.d.). Orval có thể sinh TypeScript client từ đặc tả OpenAPI hợp lệ và hỗ trợ sinh hook cho React Query (Orval, n.d.).

Ưu điểm của monorepo là giúp frontend, API Server và thư viện chia sẻ dùng cùng một nguồn định nghĩa, giảm trùng lặp code và dễ đồng bộ thay đổi. Nhược điểm là cấu hình workspace, build và dependency phức tạp hơn so với từng repository độc lập (Orval, n.d.; pnpm, n.d.).

Dự án dùng monorepo vì các thành phần liên quan chặt chẽ: đặc tả API, schema Zod, client React Query, dashboard và API Server. Việc sinh mã từ OpenAPI giúp giảm sai lệch giữa frontend và backend, phù hợp hơn viết thủ công từng hàm gọi API (OpenAPI Initiative, n.d.; Orval, n.d.; pnpm, n.d.).

### 2.15. Ghi log có cấu trúc và giám sát vận hành

Pino là thư viện ghi log JSON hiệu năng cao cho Node.js (Pino, n.d.). Ghi log có cấu trúc khác với log dạng text tự do ở chỗ mỗi dòng log có các trường rõ ràng như thời gian, level, request, response, status và thời gian xử lý.

Ưu điểm của log có cấu trúc là dễ lọc, dễ tìm kiếm và dễ kết nối với hệ thống giám sát sau này. Nhược điểm là log có thể khó đọc hơn khi xem trực tiếp nếu không có công cụ format hoặc viewer phù hợp. Cách tiếp cận này phù hợp với quan sát hệ thống hiện đại vì log có thể kết hợp với metric và trace để giải thích hành vi của ứng dụng theo nhiều góc nhìn (OpenTelemetry, n.d.).

Dự án dùng Pino cho API Server vì lớp này là điểm vào chính của dashboard và các API consumer. Khi có lỗi về kết nối MongoDB, ETL proxy, response chậm hoặc request thất bại, log có cấu trúc giúp xác định nguyên nhân nhanh hơn so với log text rời rạc (Pino, n.d.; OpenTelemetry, n.d.).

### 2.16. Các công nghệ dữ liệu quy mô lớn liên quan

Apache Spark là engine phân tích hợp nhất cho xử lý dữ liệu quy mô lớn, hỗ trợ batch, SQL, machine learning và streaming (Apache Spark, n.d.). Bài báo trên Communications of the ACM mô tả Spark như một unified engine cho xử lý dữ liệu lớn, hướng tới việc hợp nhất nhiều workload phân tích trên cùng một nền tảng (Zaharia et al., 2016). Apache Airflow là nền tảng để xây dựng, lập lịch và giám sát workflow theo dạng DAG (Apache Airflow, n.d.). Apache Kafka là nền tảng event streaming để thu thập, lưu trữ và xử lý các luồng sự kiện theo thời gian thực (Apache Kafka, n.d.). Bài báo gốc của Kafka trình bày Kafka như một hệ thống messaging phân tán cho log processing, có khả năng thu thập và phân phối dữ liệu log khối lượng lớn với độ trễ thấp (Kreps et al., 2011). Apache Iceberg là định dạng bảng mở cho các bảng phân tích rất lớn trên lưu trữ phân tán (Apache Iceberg, n.d.). Trino là engine SQL phân tán để truy vấn dữ liệu lớn từ nhiều nguồn khác nhau (Trino, n.d.). MinIO là object storage tương thích S3, phù hợp với các kiến trúc data lake hoặc lakehouse tự quản (MinIO, n.d.).

Các công nghệ này có ưu điểm lớn về khả năng mở rộng, xử lý dữ liệu lớn, tích hợp hệ sinh thái lakehouse và vận hành pipeline phức tạp. Tuy nhiên, nhược điểm là chi phí triển khai, yêu cầu hạ tầng, yêu cầu vận hành và độ phức tạp cao hơn nhiều so với nhu cầu hiện tại của dự án (Apache Spark, n.d.; Apache Airflow, n.d.; Apache Kafka, n.d.; Apache Iceberg, n.d.; Trino, n.d.; MinIO, n.d.).

Dự án chưa dùng Spark, Airflow, Kafka, Iceberg, Trino hoặc MinIO vì dữ liệu hiện tại chưa đạt quy mô cần đến distributed processing, event streaming hoặc object storage lakehouse. Thay vào đó, dự án chọn MongoDB aggregation, FastAPI service, APScheduler và Docker Compose để đạt mục tiêu vừa đủ: dễ chạy, dễ kiểm chứng, phù hợp báo cáo và có thể mở rộng sau nếu dữ liệu tăng mạnh (MongoDB, n.d.-a; MongoDB, n.d.-b; Apache Spark, n.d.; Apache Airflow, n.d.; Apache Kafka, n.d.).

## 3. Tổng quan nghiên cứu và hệ thống liên quan

Các nghiên cứu về hệ thống gợi ý du lịch cho thấy dữ liệu điểm quan tâm là nền tảng quan trọng để cá nhân hóa hành trình, giảm thời gian tìm kiếm và hỗ trợ ra quyết định. Borràs và cộng sự khảo sát các hệ thống gợi ý du lịch thông minh, trong đó nhấn mạnh sự đa dạng về thuật toán, giao diện, loại dữ liệu và chức năng trong e-tourism (Borràs et al., 2014). Các khảo sát gần đây về POI recommendation cũng cho thấy dữ liệu không đồng nhất như vị trí, ngữ cảnh, hành vi người dùng, đánh giá và thông tin địa điểm có vai trò lớn trong chất lượng gợi ý (Zhang et al., 2023).

Một hướng nghiên cứu khác liên quan trực tiếp đến dự án là chất lượng dữ liệu OpenStreetMap. Barron và cộng sự tổng quan các nghiên cứu đánh giá chất lượng OpenStreetMap và cho thấy dữ liệu OSM thường được đánh giá bằng cách so sánh với dữ liệu tham chiếu hoặc dùng chỉ số nội tại (Barron et al., 2014). Các nghiên cứu về OSM ở nhiều bối cảnh địa lý cũng chỉ ra chất lượng và độ đầy đủ của dữ liệu cộng đồng có thể khác nhau theo khu vực, loại đối tượng và mức độ tham gia của cộng đồng (Yeboah et al., 2021).

Các nghiên cứu về data lake và lakehouse cho thấy xu hướng tích hợp dữ liệu thô, dữ liệu đã xử lý, metadata, governance và analytics trong một kiến trúc thống nhất. Nghiên cứu về lakehouse của Armbrust và cộng sự đề xuất một thế hệ nền tảng mở nhằm hợp nhất data warehousing và advanced analytics (Armbrust et al., 2021). Tuy nhiên, các kiến trúc này thường hướng đến quy mô doanh nghiệp, dữ liệu lớn và hạ tầng phân tán.

Từ các nghiên cứu trên, có thể thấy dự án nằm ở giao điểm giữa ba hướng: nền tảng dữ liệu du lịch, đánh giá chất lượng dữ liệu POI và kiến trúc xử lý dữ liệu nhiều lớp. Điểm khác biệt của dự án là tập trung vào dữ liệu du lịch Việt Nam, kết hợp OSM và Google Places, đồng thời triển khai một pipeline vừa đủ để thu thập, làm giàu, chấm điểm và phục vụ dashboard (Borràs et al., 2014; Zhang et al., 2023; Barron et al., 2014; Yeboah et al., 2021).

## 4. So sánh các phương pháp và mô hình

**Bảng 1. So sánh các phương pháp và mô hình - Nhóm so sánh, Lựa chọn thứ nhất, Lựa chọn thứ hai, Nhận xét áp dụng cho dự án.**

| Nhóm so sánh | Lựa chọn thứ nhất | Lựa chọn thứ hai | Nhận xét áp dụng cho dự án |
|--------------|-------------------|------------------|-----------------------------|
| Kho dữ liệu và hồ dữ liệu | Data Warehouse | Data Lake | Data Warehouse mạnh về báo cáo có cấu trúc; Data Lake linh hoạt với dữ liệu thô nhưng cần governance tốt. Dự án dùng mô hình nhiều lớp nhẹ để giữ dữ liệu thô nhưng vẫn có lớp Gold phục vụ. |
| Hồ dữ liệu và kiến trúc hợp nhất | Data Lake | Lakehouse | Lakehouse phù hợp khi cần object storage, table format và nhiều engine xử lý. Dự án chưa cần mức đó nên mô phỏng tư duy lakehouse bằng Bronze/Silver/Gold trong MongoDB. |
| Xử lý dữ liệu | Batch | Streaming | Batch đơn giản và phù hợp dữ liệu POI thay đổi không liên tục; streaming phù hợp khi cần cập nhật gần thời gian thực. Dự án ưu tiên batch để giảm độ phức tạp. |
| Kiến trúc xử lý | Lambda | Kappa | Lambda mạnh khi cần cả batch và realtime nhưng tốn công duy trì hai pipeline; Kappa gọn hơn nhưng cần event log mạnh. Dự án chưa cần cả hai nên dùng batch pipeline có lịch chạy. |
| Lưu trữ | MongoDB | PostgreSQL | MongoDB phù hợp raw JSON và schema linh hoạt; PostgreSQL mạnh với quan hệ chặt chẽ và giao dịch phức tạp. Dự án ưu tiên MongoDB vì dữ liệu POI nhiều trường tùy chọn. |
| API | REST | GraphQL | REST đơn giản, dễ cache và phù hợp dashboard có endpoint rõ; GraphQL linh hoạt hơn nhưng tăng độ phức tạp. Dự án chọn REST. |
| Điều phối pipeline | APScheduler | Airflow | APScheduler nhẹ và đủ cho job định kỳ; Airflow mạnh hơn với DAG phức tạp và nhiều dependency. Dự án chưa cần Airflow. |
| Xử lý quy mô lớn | MongoDB aggregation | Spark | Aggregation đủ cho khối lượng hiện tại; Spark phù hợp dữ liệu lớn và cluster. Dự án chưa cần Spark. |
| Streaming | Job theo lịch | Kafka | Job theo lịch phù hợp nguồn dữ liệu cập nhật định kỳ; Kafka phù hợp event realtime. Dự án chưa cần Kafka. |

## 5. Khoảng trống nghiên cứu

Các nghiên cứu và hệ thống liên quan đã giải quyết nhiều khía cạnh riêng lẻ như gợi ý du lịch, đánh giá chất lượng OSM, kiến trúc lakehouse hoặc pipeline dữ liệu lớn. Tuy nhiên, khi áp dụng vào bối cảnh dữ liệu du lịch Việt Nam, vẫn còn một số khoảng trống (Borràs et al., 2014; Zhang et al., 2023; Barron et al., 2014; Yeboah et al., 2021; Armbrust et al., 2021):

- Nhiều nghiên cứu về gợi ý du lịch tập trung vào thuật toán đề xuất nhưng ít đi sâu vào pipeline chuẩn hóa, làm giàu và kiểm soát chất lượng dữ liệu POI đầu vào.
- Dữ liệu OSM có độ phủ và độ đầy đủ khác nhau theo khu vực, trong khi dữ liệu thương mại như Google Places lại bị ràng buộc bởi API key, quota và chi phí.
- Các kiến trúc lakehouse đầy đủ thường phù hợp doanh nghiệp lớn, nhưng có thể quá nặng cho một nền tảng dữ liệu du lịch quy mô nhỏ đến trung bình.
- Nhiều hệ thống chỉ cung cấp dữ liệu đầu ra mà thiếu cơ chế truy vết từ Gold về Bronze, thiếu vùng pending review hoặc thiếu dashboard vận hành pipeline.
- Bối cảnh dữ liệu du lịch Việt Nam cần xử lý tiếng Việt, tên địa điểm có dấu/không dấu, địa danh địa phương, danh mục POI đa dạng và dữ liệu địa chỉ không đồng nhất.

Khoảng trống chính mà dự án hướng tới là xây dựng một nền tảng dữ liệu POI vừa đủ, có kiểm soát chất lượng, có truy vết, có khả năng làm giàu từ nhiều nguồn và có dashboard vận hành, nhưng không yêu cầu hạ tầng dữ liệu lớn phức tạp (IBM, n.d.-b; IBM, n.d.-f; Borràs et al., 2014; Zhang et al., 2023).

## 6. Định hướng đề xuất của dự án

Từ các khoảng trống trên, dự án đề xuất hướng tiếp cận nền tảng dữ liệu du lịch theo kiến trúc nhiều lớp nhẹ. Thay vì triển khai đầy đủ lakehouse với object storage, Spark, Iceberg và Trino, dự án sử dụng MongoDB làm nơi lưu trữ chính cho dữ liệu document, đồng thời tổ chức dữ liệu theo Bronze, Silver và Gold để tách dữ liệu thô, dữ liệu đã xử lý và dữ liệu phục vụ (Databricks, n.d.; MongoDB, n.d.-c; MongoDB, n.d.-a; Armbrust et al., 2021).

Phương pháp đề xuất gồm bốn định hướng chính. Thứ nhất, tích hợp nhiều nguồn dữ liệu POI để tăng độ phủ và độ đầy đủ. Thứ hai, áp dụng chấm điểm chất lượng và vùng pending review để kết hợp tự động hóa với kiểm soát con người. Thứ ba, dùng API contract, validation và code generation để giảm sai lệch giữa backend và frontend. Thứ tư, đóng gói bằng Docker Compose để bảo đảm hệ thống có thể chạy nhất quán trong môi trường phát triển và trình diễn (OpenAPI Initiative, n.d.; Zod, n.d.; Docker, n.d.-a; Orval, n.d.; IBM, n.d.-b).

Định hướng này phù hợp với mục tiêu nghiên cứu ứng dụng: không nhằm tạo ra một thuật toán đề xuất mới hoặc một hệ thống big data quy mô doanh nghiệp, mà nhằm xây dựng một nền tảng dữ liệu có cơ sở lý thuyết rõ ràng, đủ tin cậy để phục vụ phân tích, quản trị pipeline và các chức năng gợi ý du lịch ở các giai đoạn sau (Borràs et al., 2014; Zhang et al., 2023; DAMA International, n.d.).

## 7. Đánh giá mức độ phù hợp

Các lựa chọn lý thuyết và công nghệ của dự án hướng đến sự cân bằng giữa tính đúng đắn, khả năng mở rộng vừa phải và độ phức tạp triển khai. Kiến trúc dữ liệu nhiều lớp phù hợp với dữ liệu nhiều nguồn và cần kiểm soát chất lượng. Quy trình trích xuất, biến đổi và nạp dữ liệu phù hợp với bài toán cập nhật theo đợt. Xử lý theo lô phù hợp vì dữ liệu điểm du lịch không yêu cầu thời gian thực. Quản trị dữ liệu, hợp đồng dữ liệu, mục tiêu mức dịch vụ và quan sát dữ liệu giúp dự án không chỉ có pipeline chạy được, mà còn có cơ sở để kiểm soát chất lượng, quyền truy cập và vận hành (IBM, n.d.-g; Databricks, n.d.; IBM, n.d.-e; Google Site Reliability Engineering, n.d.; IBM, n.d.-b; OpenTelemetry, n.d.).

MongoDB phù hợp với dữ liệu document và raw JSON. FastAPI, Pydantic và Uvicorn phù hợp với service xử lý dữ liệu bằng Python. Express, TypeScript và Pino phù hợp với API trung gian gọn nhẹ nhưng vẫn dễ kiểm soát kiểu dữ liệu và log. React, Vite, TanStack Query, Tailwind CSS, Radix UI và Recharts phù hợp với dashboard dữ liệu dạng ứng dụng một trang. pnpm workspace và Orval phù hợp với mô hình monorepo có nhiều thư viện chia sẻ. Docker Compose phù hợp để chạy nhiều service một cách nhất quán mà chưa cần đến orchestration phức tạp (MongoDB, n.d.-c; FastAPI, n.d.; MDN Web Docs, n.d.; React, n.d.-a; Vite, n.d.-a; TanStack, n.d.; Docker, n.d.-a; Uvicorn, n.d.; Orval, n.d.; pnpm, n.d.).

Dự án không ưu tiên các công nghệ nặng hơn như Kafka, Spark, GraphQL hoặc Kubernetes vì yêu cầu hiện tại chưa cần đến mức đó. Việc chọn công nghệ vừa đủ giúp hệ thống dễ phát triển, dễ vận hành, dễ giải thích và phù hợp với phạm vi một nền tảng dữ liệu du lịch quy mô nhỏ đến trung bình (Apache Spark, n.d.; Apache Airflow, n.d.; Apache Kafka, n.d.; Kreps et al., 2011).

## 8. Tài liệu tham khảo

Amazon Web Services. (n.d.). *What is streaming data?* Retrieved May 18, 2026, from https://aws.amazon.com/streaming-data/

Apache Airflow. (n.d.). *Apache Airflow documentation*. Retrieved May 18, 2026, from https://airflow.apache.org/docs/

Apache Iceberg. (n.d.). *Spec*. Retrieved May 18, 2026, from https://apache.github.io/iceberg/spec/

Apache Kafka. (n.d.). *Introduction*. Retrieved May 18, 2026, from https://kafka.apache.org/intro/

Apache Spark. (n.d.). *Apache Spark overview*. Retrieved May 18, 2026, from https://spark.apache.org/docs/latest/

Armbrust, M., Ghodsi, A., Xin, R., & Zaharia, M. (2021). *Lakehouse: A new generation of open platforms that unify data warehousing and advanced analytics*. CIDR. https://www.databricks.com/sites/default/files/2020/12/cidr_lakehouse.pdf

Barron, C., Neis, P., & Zipf, A. (2014). A comprehensive framework for intrinsic OpenStreetMap quality analysis. *Transactions in GIS, 18*(6), 877-895. https://doi.org/10.1111/tgis.12073

Borràs, J., Moreno, A., & Valls, A. (2014). Intelligent tourism recommender systems: A survey. *Expert Systems with Applications, 41*(16), 7370-7389. https://doi.org/10.1016/j.eswa.2014.06.007

DAMA International. (n.d.). *DAMA-DMBOK data management body of knowledge*. Retrieved May 18, 2026, from https://dama.org/learning-resources/dama-data-management-body-of-knowledge-dmbok/

Databricks. (n.d.). *What is the medallion lakehouse architecture?* Retrieved May 18, 2026, from https://docs.databricks.com/en/lakehouse/medallion.html

Docker. (n.d.-a). *Docker Compose*. Retrieved May 18, 2026, from https://docs.docker.com/compose/

Docker. (n.d.-b). *Multi-container applications*. Retrieved May 18, 2026, from https://docs.docker.com/get-started/docker-concepts/running-containers/multi-container-applications/

Docker. (n.d.-c). *What is Docker?* Retrieved May 18, 2026, from https://docs.docker.com/engine/docker-overview/

Ericsson. (2015). *Data processing architectures: Lambda and Kappa*. https://www.ericsson.com/en/blog/2015/11/data-processing-architectures--lambda-and-kappa

Express. (n.d.). *Node.js web application framework*. Retrieved May 18, 2026, from https://expressjs.com/

FastAPI. (n.d.). *Features*. Retrieved May 18, 2026, from https://fastapi.tiangolo.com/features/

Fielding, R. T. (2000). *Architectural styles and the design of network-based software architectures* [Doctoral dissertation, University of California, Irvine]. https://ics.uci.edu/~fielding/pubs/dissertation/abstract.htm

Gilbert, S., & Lynch, N. (2002). Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services. *ACM SIGACT News, 33*(2), 51-59. https://doi.org/10.1145/564585.564601

Google Cloud. (n.d.-a). *Dataflow: Streaming analytics*. Retrieved May 18, 2026, from https://cloud.google.com/products/dataflow

Google Cloud. (n.d.-b). *What is data governance?* Retrieved May 18, 2026, from https://cloud.google.com/learn/what-is-data-governance

Google Site Reliability Engineering. (n.d.). *Service level objectives*. Retrieved May 18, 2026, from https://sre.google/sre-book/service-level-objectives/

IBM. (n.d.-a). *Data warehouses vs. data lakes vs. data lakehouses*. Retrieved May 18, 2026, from https://www.ibm.com/think/topics/data-warehouse-vs-data-lake-vs-data-lakehouse

IBM. (n.d.-b). *What are data quality dimensions?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/data-quality-dimensions

IBM. (n.d.-c). *What is a data lakehouse?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/data-lakehouse

IBM. (n.d.-d). *What is DataOps?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/dataops

IBM. (n.d.-e). *What is data governance?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/data-governance

IBM. (n.d.-f). *What is data lineage?* Retrieved May 18, 2026, from https://www.ibm.com/topics/data-lineage

IBM. (n.d.-g). *What is ETL (extract, transform, load)?* Retrieved May 18, 2026, from https://www.ibm.com/topics/etl

IBM. (n.d.-h). *What is master data management?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/master-data-management

IBM. (n.d.-i). *What is the CAP theorem?* Retrieved May 18, 2026, from https://www.ibm.com/think/topics/cap-theorem

ISO. (2008). *ISO/IEC 25012:2008: Software engineering - Software product quality requirements and evaluation (SQuaRE) - Data quality model*. https://www.iso.org/standard/35736.html

Kreps, J. (2014). *Questioning the Lambda Architecture*. O'Reilly Radar. https://www.oreilly.com/radar/questioning-the-lambda-architecture/

Kreps, J., Narkhede, N., & Rao, J. (2011). *Kafka: A distributed messaging system for log processing*. NetDB. https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/Kafka.pdf

MDN Web Docs. (n.d.). *Express/Node introduction*. Retrieved May 18, 2026, from https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Express_Nodejs/Introduction

MinIO. (n.d.). *MinIO for Kubernetes*. Retrieved May 18, 2026, from https://min.io/docs/minio/kubernetes/upstream/index.html

MongoDB. (n.d.-a). *Aggregation pipeline*. Retrieved May 18, 2026, from https://www.mongodb.com/docs/manual/core/aggregation-pipeline/

MongoDB. (n.d.-b). *Aggregation pipeline optimization*. Retrieved May 18, 2026, from https://www.mongodb.com/docs/current/core/aggregation-pipeline-optimization/

MongoDB. (n.d.-c). *Data modeling in MongoDB*. Retrieved May 18, 2026, from https://www.mongodb.com/docs/master/core/data-model-design/

NIST. (2015). *NIST big data interoperability framework: Volume 1, definitions*. https://www.nist.gov/publications/nist-big-data-interoperability-framework-volume-1-definitions

NIST. (n.d.). *The CSF 1.1 five functions*. Retrieved May 18, 2026, from https://www.nist.gov/cyberframework/getting-started/online-learning/five-functions

NIST Computer Security Resource Center. (n.d.). *Role based access control*. Retrieved May 18, 2026, from https://csrc.nist.gov/Projects/Role-Based-Access-Control

OpenAPI Initiative. (n.d.). *The OpenAPI Specification explained*. Retrieved May 18, 2026, from https://learn.openapis.org/specification/

OpenJS Foundation. (n.d.). *About Node.js*. Retrieved May 18, 2026, from https://nodejs.org/en/about

OpenTelemetry. (n.d.). *Signals*. Retrieved May 18, 2026, from https://opentelemetry.io/docs/concepts/signals/

Orval. (n.d.). *Overview*. Retrieved May 18, 2026, from https://orval.dev/docs

Overpass API. (n.d.). *Overpass API user's manual*. Retrieved May 18, 2026, from https://dev.overpass-api.de/overpass-doc/en/

OWASP. (n.d.). *OWASP API Security Top 10*. Retrieved May 18, 2026, from https://owasp.org/API-Security/

Pino. (n.d.). *pino*. Retrieved May 18, 2026, from https://github.com/pinojs/pino

pnpm. (n.d.). *Workspace*. Retrieved May 18, 2026, from https://pnpm.io/workspaces

Pydantic. (n.d.-a). *JSON Schema*. Retrieved May 18, 2026, from https://docs.pydantic.dev/latest/concepts/json_schema/

Pydantic. (n.d.-b). *Models*. Retrieved May 18, 2026, from https://docs.pydantic.dev/latest/concepts/models/

Python Package Index. (n.d.). *APScheduler*. Retrieved May 18, 2026, from https://pypi.org/pypi/APScheduler

Python Software Foundation. (n.d.). *Applications for Python*. Retrieved May 18, 2026, from https://www.python.org/about/apps/

Radix UI. (n.d.). *Accessibility*. Retrieved May 18, 2026, from https://www.radix-ui.com/primitives/docs/overview/accessibility

RapidAPI. (n.d.). *RapidAPI Hub documentation*. Retrieved May 18, 2026, from https://docs.rapidapi.com/

React. (n.d.-a). *React documentation*. Retrieved May 18, 2026, from https://react.dev/

React. (n.d.-b). *Your first component*. Retrieved May 18, 2026, from https://react.dev/learn/your-first-component

Recharts. (n.d.). *Recharts*. Retrieved May 18, 2026, from https://recharts.github.io/

Tableau. (n.d.). *What is a KPI dashboard?* Retrieved May 18, 2026, from https://www.tableau.com/kpi/what-is-kpi-dashboard

Tailwind CSS. (n.d.-a). *Documentation*. Retrieved May 18, 2026, from https://tailwindcss.com/docs

Tailwind CSS. (n.d.-b). *Styling with utility classes*. Retrieved May 18, 2026, from https://tailwindcss.com/docs/utility-first

TanStack. (n.d.). *TanStack Query*. Retrieved May 18, 2026, from https://tanstack.com/query/

Trino. (n.d.). *Overview*. Retrieved May 18, 2026, from https://trino.io/docs/current/overview.html

TypeScript. (n.d.). *Basic types*. Retrieved May 18, 2026, from https://www.typescriptlang.org/docs/handbook/basic-types.html

Uvicorn. (n.d.). *ASGI*. Retrieved May 18, 2026, from https://www.uvicorn.org/concepts/asgi/

Vite. (n.d.-a). *Getting started*. Retrieved May 18, 2026, from https://main.vite.dev/guide/

Vite. (n.d.-b). *Why Vite*. Retrieved May 18, 2026, from https://vite.dev/guide/why.html

W3C. (2013). *PROV-overview: An overview of the PROV family of documents*. https://www.w3.org/TR/prov-overview/

W3C. (2017). *Data on the Web best practices*. https://www.w3.org/TR/dwbp/

Wilkinson, M. D., Dumontier, M., Aalbersberg, I. J., Appleton, G., Axton, M., Baak, A., Blomberg, N., Boiten, J. W., da Silva Santos, L. B., Bourne, P. E., Bouwman, J., Brookes, A. J., Clark, T., Crosas, M., Dillo, I., Dumon, O., Edmunds, S., Evelo, C. T., Finkers, R., & Mons, B. (2016). The FAIR Guiding Principles for scientific data management and stewardship. *Scientific Data, 3*, Article 160018. https://doi.org/10.1038/sdata.2016.18

Yeboah, G., Porto de Albuquerque, J., Troilo, R., Tregonning, G., Perera, S., & Ahmed, S. A. K. S. (2021). Analysis of OpenStreetMap data quality at different stages of a participatory mapping process. *ISPRS International Journal of Geo-Information, 10*(4), Article 265. https://www.mdpi.com/2220-9964/10/4/265

Zaharia, M., Xin, R. S., Wendell, P., Das, T., Armbrust, M., Dave, A., Meng, X., Rosen, J., Venkataraman, S., Franklin, M. J., Ghodsi, A., Gonzalez, J., Shenker, S., & Stoica, I. (2016). Apache Spark: A unified engine for big data processing. *Communications of the ACM, 59*(11), 56-65. https://cacm.acm.org/research/apache-spark/

Zhang, J., Chow, C.-Y., & Li, Y. (2023). *A survey on point-of-interest recommendations leveraging heterogeneous data*. arXiv. https://arxiv.org/abs/2308.07426

Zod. (n.d.). *Introduction*. Retrieved May 18, 2026, from https://zod.dev/
