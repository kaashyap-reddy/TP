from pathlib import Path
from PIL import Image, ImageDraw


folder = Path("tmp/pdfs/brd_frd_userstories")
pages = sorted(folder.glob("page-*.png"))

for group_index, start in enumerate(range(0, len(pages), 7), 1):
    sheet = Image.new("RGB", (1200, 1600), "#dce5e9")
    for slot, page_path in enumerate(pages[start:start + 7]):
        page = Image.open(page_path).convert("RGB")
        page.thumbnail((360, 500))
        card = Image.new("RGB", (380, 540), "white")
        card.paste(page, ((380 - page.width) // 2, 25))
        ImageDraw.Draw(card).text((12, 8), page_path.name, fill="#22313f")
        sheet.paste(card, (15 + (slot % 3) * 395, 15 + (slot // 3) * 525))
    sheet.save(folder / f"contact_{group_index}.jpg", quality=90)
