FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（psycopg2 需要 libpq）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# 先复制 requirements 利用 Docker 层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令（docker-compose 中 command 会覆盖此项）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
