下载必要的相关依赖：
- Python 3.11+
- pip
- git
- PostgreSQL
    - CREATE USER soundtag WITH PASSWORD 'soundtag';
    - CREATE DATABASE soundtag OWNER soundtag;
    - GRANT ALL PRIVILEGES ON DATABASE soundtag TO soundtag;


我的远程服务器的ip地址是121.196.165.152，登录密码是15258223655Ptf.当前我已
  经执行完 uvicorn app.main:app --host 0.0.0.0 --port 8000，我的远程服务器文件路径是/home/pp/SoundTag# ，pp用户密码是
  256337。现在你能否直接登录我的远程服务器然后为我启动这个后端项目。请注意，需要把我当前本地的PostgreSQL内容也同步到远程服务器