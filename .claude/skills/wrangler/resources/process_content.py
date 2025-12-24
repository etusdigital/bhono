#!/usr/bin/env python3
"""
Processa o conteúdo completo da documentação do Wrangler e extrai seções
"""

import re
import os

# Mapeamento de seções - nome do arquivo e padrão de header
SECTION_MAPPING = [
    ("how-to-run.md", r"## How to run Wrangler commands"),
    ("docs.md", r"## `docs`"),
    ("init.md", r"## `init`"),
    ("containers.md", r"## `containers`"),
    ("d1.md", r"## `d1`"),
    ("hyperdrive.md", r"## `hyperdrive`"),
    ("vectorize.md", r"## `vectorize`"),
    ("dev.md", r"## `dev`"),
    ("deploy.md", r"## `deploy`"),
    ("delete.md", r"## `delete`"),
    ("kv-namespace.md", r"## `kv namespace`"),
    ("kv-key.md", r"## `kv key`"),
    ("kv-bulk.md", r"## `kv bulk`"),
    ("r2-bucket.md", r"## `r2 bucket`"),
    ("r2-object.md", r"## `r2 object`"),
    ("r2-sql.md", r"## r2 SQL|## `r2 sql`"),
    ("setup.md", r"## `setup`"),
    ("secret.md", r"## `secret`"),
    ("secrets-store-secret.md", r"## `secrets-store secret`"),
    ("secrets-store-store.md", r"## `secrets-store store`"),
    ("workflows.md", r"## `workflows`"),
    ("tail.md", r"## `tail`"),
    ("pages.md", r"## `pages`"),
    ("pipelines.md", r"## `pipelines`"),
    ("queues.md", r"## `queues`"),
    ("login.md", r"## `login`"),
    ("logout.md", r"## `logout`"),
    ("whoami.md", r"## `whoami`"),
    ("versions.md", r"## `versions`"),
    ("triggers.md", r"## `triggers`"),
    ("deployments.md", r"## `deployments`"),
    ("rollback.md", r"## `rollback`"),
    ("dispatch-namespace.md", r"## dispatch namespace|## `dispatch-namespace`"),
    ("mtls-certificate.md", r"## `mtls-certificate`"),
    ("cert.md", r"## `cert`"),
    ("types.md", r"## `types`"),
    ("telemetry.md", r"## `telemetry`"),
    ("check.md", r"## `check`"),
]

def extract_sections(content, output_dir):
    """Extrai seções do conteúdo completo"""
    lines = content.split('\n')
    sections = {}
    
    # Encontra todas as seções baseadas nos headers
    current_section = None
    current_content = []
    
    for i, line in enumerate(lines, 1):
        # Verifica se é um header de seção
        for filename, pattern in SECTION_MAPPING:
            if re.match(pattern, line, re.IGNORECASE):
                # Salva seção anterior se existir
                if current_section:
                    sections[current_section] = '\n'.join(current_content).strip()
                
                # Inicia nova seção
                current_section = filename
                current_content = [line]
                break
        else:
            # Adiciona linha ao conteúdo atual
            if current_section:
                current_content.append(line)
    
    # Salva última seção
    if current_section:
        sections[current_section] = '\n'.join(current_content).strip()
    
    # Escreve arquivos
    for filename, section_content in sections.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(section_content)
        print(f"✓ Criado: {filename} ({len(section_content.split(chr(10)))} linhas)")
    
    return sections

if __name__ == "__main__":
    print("Script de processamento criado.")
    print("Este script precisa ser executado com o conteúdo completo da documentação.")


