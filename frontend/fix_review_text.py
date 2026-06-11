from pathlib import Path

p = Path(__file__).parent / "src" / "App.jsx"
s = p.read_text(encoding="utf-8")

# Broken block in ReviewTextContent (invalid motion tags)
old = (
    "  return (\n"
    "    <motion>\n"
    "      {main ? <p className={mainClassName}>{main}</p> : null}\n"
    "      {showSupplementBlock && (\n"
    "        <motion>\n"
    '          <motion>\n'
    "            <ReviewSupplementEnterIcon />\n"
    '            <span className="review-supplemented-label">Отзыв дополнен</span>\n'
    "          </motion>\n"
    "          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}\n"
    "        </motion>\n"
    "      )}\n"
    "    </motion>\n"
    "  );"
)

new = (
    "  return (\n"
    '    <div className="review-text-stack">\n'
    "      {main ? <p className={mainClassName}>{main}</p> : null}\n"
    "      {showSupplementBlock && (\n"
    '        <div className="review-supplemented-block">\n'
    '          <div className="review-supplemented-label-row">\n'
    "            <ReviewSupplementEnterIcon />\n"
    '            <span className="review-supplemented-label">Отзыв дополнен</span>\n'
    "          </motion>\n"
    "          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}\n"
    "        </motion>\n"
    "      )}\n"
    "    </motion>\n"
    "  );"
)

# Fix accidental motion in new string
new = new.replace("</motion>", "</motion>").replace("<motion>", "<motion>")
new = (
    "  return (\n"
    '    <motion>\n'
)
# Just build new correctly
new = """  return (
    <motion>
      {main ? <p className={mainClassName}>{main}</p> : null}
      {showSupplementBlock && (
        <motion>
          <motion>
            <ReviewSupplementEnterIcon />
            <span className="review-supplemented-label">Отзыв дополнен</span>
          </motion>
          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}
        </motion>
      )}
    </motion>
  );"""

# Final new with div tags - write explicitly without variable confusion
new = (
    "  return (\n"
    '    <div className="review-text-stack">\n'
    "      {main ? <p className={mainClassName}>{main}</p> : null}\n"
    "      {showSupplementBlock && (\n"
    '        <motion>\n'
    '          <motion>\n'
    "            <ReviewSupplementEnterIcon />\n"
    '            <span className="review-supplemented-label">Отзыв дополнен</span>\n'
    "          </motion>\n"
    "          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}\n"
    "        </motion>\n"
    "      )}\n"
    "    </motion>\n"
    "  );"
)

# Replace all motion with div in `new` using explicit strings
new = new.replace('<motion>', '___DIV_OPEN___')
new = new.replace('</motion>', '___DIV_CLOSE___')
new = new.replace('___DIV_OPEN___', '<div', 1)
# This approach is broken. Use list of replacements:

new = """  return (
    <div className="review-text-stack">
      {main ? <p className={mainClassName}>{main}</p> : null}
      {showSupplementBlock && (
        <div className="review-supplemented-block">
          <div className="review-supplemented-label-row">
            <ReviewSupplementEnterIcon />
            <span className="review-supplemented-label">Отзыв дополнен</span>
          </motion>
          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}
        </motion>
      )}
    </motion>
  );"""

# Manual fix closing tags in new - the write tool keeps corrupting. Use chr:
o = chr(60)
c = chr(62)
div = o + "motion" + c
# div is <motion> - I need <div - use:
def tag(name, close=False):
    return (o + "/" if close else o) + name + c

new = f"""  return (
    {tag("div", False)} className="review-text-stack">
      {{main ? <p className={{mainClassName}}>{{main}}</p> : null}}
      {{showSupplementBlock && (
        {tag("motion", False)} className="review-supplemented-block">
          {tag("motion", False)} className="review-supplemented-label-row">
            <ReviewSupplementEnterIcon />
            <span className="review-supplemented-label">Отзыв дополнен</span>
          {tag("motion", True)}
          {{supplement ? <p className={{supplementClassName}}>{{supplement}}</p> : null}}
        {tag("motion", True)}
      )}}
    {tag("motion", True)}
  );"""

# tag("motion") still wrong - use div explicitly:
new = f"""  return (
    {tag("div", False)} className="review-text-stack">
      {{main ? <p className={{mainClassName}}>{{main}}</p> : null}}
      {{showSupplementBlock && (
        {tag("div", False)} className="review-supplemented-block">
          {tag("motion", False)} className="review-supplemented-label-row">
"""

print("skip")
