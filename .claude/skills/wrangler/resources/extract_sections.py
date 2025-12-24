#!/usr/bin/env python3
"""
Script para extrair seções do conteúdo completo da documentação do Wrangler
e criar arquivos individuais conforme o mapeamento de linhas fornecido.
"""

import re
import os

# Mapeamento de seções conforme fornecido pelo usuário
SECTIONS = [
    (64, 126, "how-to-run.md"),
    (127, 188, "docs.md"),
    (189, 220, "init.md"),
    (221, 376, "containers.md"),
    (377, 1220, "d1.md"),
    (1221, 1646, "hyperdrive.md"),
    (1647, 2588, "vectorize.md"),
    (2589, 2750, "dev.md"),
    (2751, 2896, "deploy.md"),
    (2897, 2924, "delete.md"),
    (2925, 3192, "kv-namespace.md"),
    (3193, 3548, "kv-key.md"),
    (3549, 3818, "kv-bulk.md"),
    (3819, 6114, "r2-bucket.md"),
    (6115, 6384, "r2-object.md"),
    (6385, 6452, "r2-sql.md"),
    (6453, 6520, "setup.md"),
    (6521, 6827, "secret.md"),
    (6828, 7312, "secrets-store-secret.md"),
    (7313, 7541, "secrets-store-store.md"),
    (7542, 8165, "workflows.md"),
    (8166, 8265, "tail.md"),
    (8266, 9265, "pages.md"),
    (9266, 10239, "pipelines.md"),
    (10240, 11489, "queues.md"),
    (11490, 11550, "login.md"),
    (11551, 11579, "logout.md"),
    (11580, 11637, "whoami.md"),
    (11638, 12195, "versions.md"),
    (12196, 12273, "triggers.md"),
    (12274, 12401, "deployments.md"),
    (12402, 12429, "rollback.md"),
    (12430, 12717, "dispatch-namespace.md"),
    (12718, 12974, "mtls-certificate.md"),
    (12975, 13281, "cert.md"),
    (13282, 13329, "types.md"),
    (13330, 13372, "telemetry.md"),
    (13373, 13406, "check.md"),
]

def extract_section_by_header(content, section_name):
    """Extrai uma seção baseada no header markdown"""
    # Padrões para identificar seções
    patterns = {
        "how-to-run": r"## How to run Wrangler commands",
        "docs": r"## `docs`",
        "init": r"## `init`",
        "containers": r"## `containers`",
        "d1": r"## `d1`",
        "hyperdrive": r"## `hyperdrive`",
        "vectorize": r"## `vectorize`",
        "dev": r"## `dev`",
        "deploy": r"## `deploy`",
        "delete": r"## `delete`",
        "kv-namespace": r"## `kv namespace`",
        "kv-key": r"## `kv key`",
        "kv-bulk": r"## `kv bulk`",
        "r2-bucket": r"## `r2 bucket`",
        "r2-object": r"## `r2 object`",
        "r2-sql": r"## r2 SQL|## `r2 sql`",
        "setup": r"## `setup`",
        "secret": r"## `secret`",
        "secrets-store-secret": r"## `secrets-store secret`",
        "secrets-store-store": r"## `secrets-store store`",
        "workflows": r"## `workflows`",
        "tail": r"## `tail`",
        "pages": r"## `pages`",
        "pipelines": r"## `pipelines`",
        "queues": r"## `queues`",
        "login": r"## `login`",
        "logout": r"## `logout`",
        "whoami": r"## `whoami`",
        "versions": r"## `versions`",
        "triggers": r"## `triggers`",
        "deployments": r"## `deployments`",
        "rollback": r"## `rollback`",
        "dispatch-namespace": r"## dispatch namespace|## `dispatch-namespace`",
        "mtls-certificate": r"## `mtls-certificate`",
        "cert": r"## `cert`",
        "types": r"## `types`",
        "telemetry": r"## `telemetry`",
        "check": r"## `check`",
    }
    
    pattern = patterns.get(section_name)
    if not pattern:
        return None
    
    # Encontra o início da seção
    match = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    
    start_pos = match.start()
    
    # Encontra o próximo header de nível 2 (##) ou o fim do arquivo
    next_header = re.search(r'\n## ', content[start_pos + 1:])
    if next_header:
        end_pos = start_pos + next_header.start() + 1
        return content[start_pos:end_pos].strip()
    else:
        return content[start_pos:].strip()

if __name__ == "__main__":
    print("Este script precisa do conteúdo completo da documentação.")
    print("Use o conteúdo obtido do Firecrawl para processar.")


