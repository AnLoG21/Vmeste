FROM andrius/asterisk:20

USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl \
    && rm -rf /var/lib/apt/lists/* \
    && chmod +x /usr/share/asterisk/agi-bin/* 2>/dev/null || true

COPY bridge/vmeste_agi.py /usr/share/asterisk/agi-bin/vmeste_agi.py
RUN chmod +x /usr/share/asterisk/agi-bin/vmeste_agi.py

COPY conf/base/ /etc/asterisk/base/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
# Avoid -vvv: verbose console floods messages.log and fills the VPS disk.
CMD ["asterisk", "-f", "-U", "asterisk", "-G", "asterisk"]
