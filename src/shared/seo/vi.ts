import type { SeoMessages } from "./en.ts";

export default {
	title: "Đồng hồ online chính xác đến mili giây | {name}",
	description:
		"Đồng hồ online miễn phí hiển thị mili giây, đối chiếu nhiều máy chủ giờ nguyên tử, cho biết sai số tối đa. Quay màn hình để đo độ lệch timecode máy quay.",
	ogImageAlt: "{name}: đồng hồ mili giây cỡ lớn kèm sai số tối đa",
	h1: "{name}: đồng hồ online chính xác đến mili giây",
	intro:
		"{name} là đồng hồ online miễn phí hiển thị thời gian hiện tại đến mili giây. Thay vì tin vào đồng hồ của thiết bị này, trang hỏi nhiều máy chủ thời gian độc lập (máy chủ biên Cloudflare, Akamai, NICT của Nhật Bản, timeapi.io và time.now), chỉ giữ lại những máy chủ cho kết quả khớp nhau và cho bạn biết giờ hiển thị có thể lệch tối đa bao nhiêu. Không cần đăng ký hay cài đặt, dùng được ở mọi múi giờ.",
	howHeading: "Đo độ lệch của máy quay và timecode",
	how1: "Mở trang này trên một màn hình, chọn múi giờ và chờ đến khi các nguồn thời gian khớp nhau và sai số tối đa nhỏ lại.",
	how2: "Quay màn hình bằng máy quay, điện thoại hoặc máy ghi hình. Tốc độ màn trập nhanh giúp các chữ số không bị nhòe, mỗi khung hình chỉ hiển thị một giá trị.",
	how3: "Trong phần mềm dựng, hãy so sánh timecode hoặc dấu thời gian tệp của một khung hình với giờ hiển thị trong chính khung hình đó. Làm lại ở thời điểm sau trong đoạn ghi: sự thay đổi của chênh lệch chính là độ lệch (drift).",
	boundHeading: "Sai số tối đa nghĩa là gì",
	boundBody:
		"Câu trả lời của máy chủ thời gian chỉ có thể sai tối đa bằng thời gian khứ hồi, nên mỗi câu trả lời trở thành một khoảng chắc chắn chứa thời gian thực. Đồng hồ lấy vùng có nhiều khoảng chồng lên nhau nhất (thuật toán Marzullo), loại các máy chủ không khớp và hiển thị điểm giữa của vùng đó. Giá trị ± là giới hạn cứng, không phải ước lượng thống kê. Trang cũng học tốc độ chạy của đồng hồ thiết bị này nên vẫn giữ giờ chính xác giữa các lần kiểm tra.",
	faqHeading: "Câu hỏi thường gặp",
	q1: "Đồng hồ online này chính xác đến mức nào?",
	a1: "Tùy thuộc vào mạng của bạn. Với kết nối thông thường, sai số tối đa chỉ vài mili giây và được hiển thị trực tiếp trên trang. Độ trễ một khung hình của màn hình được bù tự động, và bạn có thể bù thêm trong phần Cài đặt.",
	q2: "Có chính xác như đồng hồ nguyên tử không?",
	a2: "Các máy chủ được hỏi đều theo giờ UTC do đồng hồ nguyên tử duy trì, vì vậy trang hiển thị giờ nguyên tử trong phạm vi sai số tối đa được hiển thị. Độ trễ của màn hình và máy quay không nằm trong giới hạn này.",
	q3: "Vì sao đồng hồ máy tính hoặc điện thoại của tôi khác?",
	a3: "Đồng hồ thiết bị trôi dần và chỉ thỉnh thoảng mới được chỉnh lại. Trang cho biết đồng hồ thiết bị này lệch bao nhiêu so với giờ thực và chạy nhanh chậm thế nào, tính bằng phần triệu (ppm).",
	q4: "Có dùng được với múi giờ và ngôn ngữ của tôi không? Có miễn phí không?",
	a4: "Có. Bạn có thể chọn bất kỳ múi giờ IANA nào (như Asia/Tokyo hoặc America/New_York), trang có sẵn bằng {languages} ngôn ngữ, miễn phí và không cần đăng ký.",
} satisfies SeoMessages;
