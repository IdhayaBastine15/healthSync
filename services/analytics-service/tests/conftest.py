import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("JWT_PUBLIC_KEY_PATH", str(Path(__file__).resolve().parents[3] / "shared" / "keys" / "jwt_public.pem"))
