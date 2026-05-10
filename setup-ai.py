#!/usr/bin/env python3
"""
AI Service Setup Script
Installs dependencies and initializes the AI service
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description):
    """Run a shell command and handle errors"""
    print(f"\n📦 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=False, text=True)
        if result.returncode != 0:
            print(f"❌ {description} failed")
            return False
        print(f"✅ {description} completed")
        return True
    except Exception as e:
        print(f"❌ Error during {description}: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("🤖 DAVINCI AI SERVICE SETUP")
    print("="*60)
    
    # Get the ai-service directory
    ai_service_dir = Path(__file__).parent / "ai-service"
    os.chdir(ai_service_dir)
    
    # 1. Create venv if it doesn't exist
    venv_dir = ai_service_dir / "venv"
    if not venv_dir.exists():
        print("\n📦 Creating Python virtual environment...")
        if not run_command(f"python -m venv {venv_dir}", "Virtual environment creation"):
            sys.exit(1)
    
    # 2. Activate venv (for Windows)
    venv_python = venv_dir / "Scripts" / "python.exe"
    venv_pip = venv_dir / "Scripts" / "pip.exe"
    
    if not venv_python.exists():
        venv_python = venv_dir / "bin" / "python"
        venv_pip = venv_dir / "bin" / "pip"
    
    # 3. Install requirements
    requirements_file = ai_service_dir / "requirements.txt"
    if requirements_file.exists():
        print(f"\n📦 Installing dependencies from {requirements_file}...")
        if not run_command(f'"{venv_pip}" install -r "{requirements_file}"', "Dependency installation"):
            print("⚠️  Some dependencies failed to install, but continuing...")
    
    # 4. Create data directories
    print("\n📁 Creating data directories...")
    data_dir = ai_service_dir / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "chroma_db").mkdir(exist_ok=True)
    print("✅ Data directories created")
    
    # 5. Print next steps
    print("\n" + "="*60)
    print("✨ AI SERVICE SETUP COMPLETED!")
    print("="*60)
    print("\n📝 Next steps:")
    print(f"  1. Update .env with database credentials")
    print(f"  2. Activate venv:")
    print(f"     cd ai-service")
    if sys.platform == "win32":
        print(f"     .\\venv\\Scripts\\activate")
    else:
        print(f"     source venv/bin/activate")
    print(f"  3. Start AI service:")
    print(f"     python main.py")
    print()

if __name__ == "__main__":
    main()
