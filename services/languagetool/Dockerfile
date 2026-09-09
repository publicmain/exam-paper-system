# LanguageTool —— 学生写作自查的后端。
#
# 自托管而不是用 languagetool.org 的公共接口，两个原因：
#   1. 学生写的东西不出自己的服务器；
#   2. 一个学校共用一个出口 IP，公共接口的限流一节课就打满。
#
# 只开英语，省内存（全语言要 2 GB 以上，只留英语约 700 MB 够用）。
FROM erikvl87/languagetool:6.6

# Java 堆上限跟着 Railway 的容器规格走；给 JVM 之外留一点余量。
ENV Java_Xms=256m \
    Java_Xmx=768m \
    langtool_languageModel=/ngrams \
    langtool_pipelineCaching=true \
    langtool_maxCheckThreads=4

EXPOSE 8010
