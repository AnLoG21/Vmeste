"""Shared Cyrillic-capable TTF discovery for fpdf2 (inspections + cafe receipts)."""

from __future__ import annotations

import os
import platform


class PdfFontError(RuntimeError):
    """Raised when no Unicode TTF is available for Cyrillic PDF output."""


def packaged_fonts_dir() -> str:
    return os.path.normpath(
        os.path.join(os.path.dirname(__file__), "inspections", "fonts")
    )


def find_cyrillic_font() -> tuple[str, str | None]:
    """
    Return (regular_ttf_path, bold_ttf_path_or_none).
    Prefer packaged DejaVu, then OS fonts. Raises PdfFontError if regular is missing.
    """
    pkg = packaged_fonts_dir()
    regular_candidates = [
        os.path.join(pkg, "DejaVuSans.ttf"),
        os.path.join(pkg, "arial.ttf"),
    ]
    bold_candidates = [
        os.path.join(pkg, "DejaVuSans-Bold.ttf"),
        os.path.join(pkg, "arialbd.ttf"),
    ]
    if platform.system() == "Windows":
        regular_candidates.extend(
            [
                r"C:\Windows\Fonts\arial.ttf",
                r"C:\Windows\Fonts\segoeui.ttf",
            ]
        )
        bold_candidates.extend(
            [
                r"C:\Windows\Fonts\arialbd.ttf",
                r"C:\Windows\Fonts\segoeuib.ttf",
            ]
        )
    regular_candidates.extend(
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        ]
    )
    bold_candidates.extend(
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        ]
    )
    regular = next((p for p in regular_candidates if os.path.isfile(p)), None)
    bold = next((p for p in bold_candidates if os.path.isfile(p)), None)
    if not regular:
        raise PdfFontError(
            "Не найден шрифт с кириллицей для PDF. "
            "Ожидается inspections/fonts/DejaVuSans.ttf или fonts-dejavu-core."
        )
    return regular, bold
