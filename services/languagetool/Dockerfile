# LanguageTool —— 学生写作自查的后端。
#
# 自己构建而不是用现成镜像：erikvl87/languagetool 的 6.6 和 6.8 两个 tag 里
# JRE 比 jar 旧，起不来（UnsupportedClassVersionError: class file version 61.0
# = Java 17）。这里显式用 Temurin 21，版本自己说了算。
#
# 只跑英语。全语言要 2 GB 以上内存，我们只有英语要查。
FROM eclipse-temurin:21-jre-jammy

ARG LT_VERSION=6.6
WORKDIR /opt

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && curl -fsSL -o lt.zip "https://languagetool.org/download/LanguageTool-${LT_VERSION}.zip" \
 && unzip -q lt.zip \
 && mv "LanguageTool-${LT_VERSION}" languagetool \
 && rm lt.zip \
 && apt-get purge -y unzip curl \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/languagetool

# 堆上限给 768m：只装英语约 700 MB 够用。Railway 规格更小就把这个调低 ——
# API 侧是 6 秒超时后静默降级，查不动也不会挡住学生答题。
ENV JAVA_OPTS="-Xms256m -Xmx768m"
EXPOSE 8010

# --public 让容器外能访问；Railway 内网访问也走这个。
CMD ["sh", "-c", "exec java $JAVA_OPTS -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8010 --public --allow-origin '*'"]
