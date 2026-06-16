from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    elpass_base_url: str = "https://pass.telecom.quest/api"
    elpass_email: str = "dashboard@elpass.kz"
    elpass_password: str = "D@shboard1!"

    page_size: int = 100
    max_rows: int = 50000
    max_concurrent: int = 10

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Impala (BDAS) — set IMPALA_ENABLED=true once credentials are in env
    impala_enabled: bool = False
    impala_host: str = "bdas-worker-02.bdpak.telecom.kz"
    impala_port: int = 21050
    impala_database: str = "default"
    impala_ssl: bool = True
    impala_user: str = ""
    impala_password: str = ""
    impala_table: str = "drb.drb_assanali_ndkt_cal"


settings = Settings()
