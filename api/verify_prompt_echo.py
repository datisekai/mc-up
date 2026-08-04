"""Kiểm chứng lưới chặn PROMPT-ECHO (bug 2026-08-04).

Chạy:  cd mcup && api/.venv/bin/python api/verify_prompt_echo.py
Không cần server / không gọi API trả tiền — thuần so khớp chuỗi.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.asr_whisper import _is_prompt_echo, _FILLER_PROMPT
from api.app.scoring import _looks_unclear
fails=[]
def check(name, got, want):
    ok = got == want
    print(("  PASS  " if ok else "  FAIL  ")+name+(f"   (got={got})" if not ok else ""))
    if not ok: fails.append(name)

print("=== PHẢI CHẶN (prompt echo) ===")
check("echo nguyên văn", _is_prompt_echo(_FILLER_PROMPT), True)
check("echo có nhiễu nhẹ", _is_prompt_echo("Xin chào quý vị và các bạn, chào mừng đến với chương trình. Ừm, à, ờ. Bản ghi tiếng Việt, giữ nguyên tiếng đệm khi nói. Sân khấu, tiệc cưới."), True)
check("chỉ phần đuôi từ vựng", _is_prompt_echo("Sân khấu, tiệc cưới, cô dâu chú rể, quan khách, sự kiện, gala, khán giả, tiết mục, phần thi, thí sinh."), True)
check("đuôi từ vựng xáo trộn", _is_prompt_echo("Gala, khán giả, thí sinh, tiết mục, sân khấu, quan khách, tiệc cưới nhé các bạn ạ."), True)

print("\n=== KHÔNG ĐƯỢC CHẶN NHẦM (học viên nói thật) ===")
check("bài MC đám cưới thật", _is_prompt_echo("Kính thưa quý vị đại biểu, thưa toàn thể quan khách. Hôm nay chúng ta có mặt tại đây để chung vui cùng cô dâu chú rể trong ngày trọng đại. Xin một tràng pháo tay thật lớn chào đón đôi uyên ương bước lên sân khấu."), False)
check("transcript thật (giọng Linh)", _is_prompt_echo("Kính thưa quý vị đại biểu, thưa toàn thể quý khách, hôm nay chúng ta có mặt tại đây để chào mừng lễ kỷ niệm 10 năm thành lập công ty ừm, à, chương trình chương trình của chúng ta gồm ba phần chính."), False)
check("lời chào MC ngắn (đầu prompt)", _is_prompt_echo("Xin chào quý vị và các bạn, chào mừng đến với chương trình."), False)
check("bài gameshow thật (có thí sinh/tiết mục)", _is_prompt_echo("Và bây giờ xin mời thí sinh số một bước lên sân khấu để trình bày tiết mục dự thi của mình, xin quý khán giả cho một tràng pháo tay."), False)
check("bài ngắn", _is_prompt_echo("Xin chào mọi người"), False)
check("rỗng", _is_prompt_echo(""), False)

print("\n=== Sau khi chặn → rơi đúng nhánh 'chưa nghe rõ' ===")
check("text rỗng bị coi là chưa nghe rõ", _looks_unclear("", []), True)
print("\n"+("TẤT CẢ PASS" if not fails else f"LỖI: {fails}"))
sys.exit(1 if fails else 0)
