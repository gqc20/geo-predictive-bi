import os
import sys
import subprocess
import time

# Fix encoding para Windows: forzar UTF-8 en stdout/stderr
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Intentamos importar rich, o usamos print básico si no está (aunque lo instalaremos)
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.prompt import Prompt
    from rich.progress import Progress, SpinnerColumn, TextColumn
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

console = Console(force_terminal=True, legacy_windows=False) if HAS_RICH else None

def clear_screen():
    print('\033[2J\033[H', end='')

def show_header():
    if HAS_RICH:
        header_text = """
        [bold cyan]🗺️  GEO-PREDICTIVE BI[/bold cyan]
        [italic white]Cognitive Engine & Geospatial Analytics[/italic white]
        """
        console.print(Panel(header_text, border_style="blue", expand=False))
    else:
        print("\n" + "="*40)
        print("🗺️  GEO-PREDICTIVE BI")
        print("Cognitive Engine & Geospatial Analytics")
        print("="*40 + "\n")

def run_command(command_list, description, is_long_running=False, extra_env=None):
    command_str = ' '.join(str(c) for c in command_list)
    if HAS_RICH:
        console.print(f"\n[bold yellow]>> {description}[/bold yellow]")
    else:
        print(f"\n>> {description}")
        
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)

    try:
        if is_long_running:
            subprocess.run(command_list, env=env)
        else:
            if HAS_RICH:
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    transient=True,
                ) as progress:
                    progress.add_task(description=f"Ejecutando: {command_str}", total=None)
                    result = subprocess.run(command_list, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
                    
                    if result.returncode == 0:
                        console.print(f"[bold green]✅ Éxito:[/bold green] {description}")
                    else:
                        console.print(f"[bold red]❌ Error:[/bold red] {description}")
                        if result.stdout:
                            console.print(f"[white]{result.stdout}[/white]")
                        if result.stderr:
                            console.print(f"[red]{result.stderr}[/red]")
            else:
                print(f"Ejecutando: {command_str}...")
                result = subprocess.run(command_list, env=env)
                if result.returncode == 0:
                    print(f"✅ Éxito: {description}")
                else:
                    print(f"❌ Error: {description}")
    except Exception as e:
        if HAS_RICH:
            console.print(f"[bold red]💥 Excepción:[/bold red] {str(e)}")
        else:
            print(f"💥 Excepción: {str(e)}")

def main_menu():
    while True:
        clear_screen()
        show_header()
        
        if HAS_RICH:
            table = Table(title="Panel de Control Central", border_style="blue")
            table.add_column("ID", style="cyan", no_wrap=True)
            table.add_column("Acción", style="white")
            table.add_column("Archivo / Script", style="green")
            table.add_column("Estado Recomendado", style="magenta")

            table.add_row("1", "📦 [bold]Infraestructura[/bold] (Docker Up)", "docker-compose.yml", "Inicio")
            table.add_row("2", "🚀 [bold]Pipeline Maestro[/bold] (Bronce > Plata > Oro)", "src/pipeline_master.py", "Procesamiento")
            table.add_row("3", "📊 [bold]Dashboard Premium[/bold] (React/Vite)", "dashboard-premium/", "Visualización")
            table.add_row("4", "🧪 [bold]Pruebas de Calidad[/bold] (Pytest)", "tests/ (*.py)", "QA")
            table.add_row("5", "🧹 [bold]Limpiar Servicios[/bold] (Docker Down)", "docker-compose.yml", "Mantenimiento")
            table.add_row("6", "📝 [bold]Ver Historial de Logs[/bold]", "logs/execution.log", "Depuración")
            table.add_row("0", "❌ [bold]Salir[/bold]", "-", "-")
            console.print(table)
            choice = Prompt.ask("\n[bold]Selecciona una opción[/bold]", choices=["1", "2", "3", "4", "5", "6", "0"], default="0")
        else:
            print("ID | Acción | Archivo")
            print("1. [📦] Infraestructura -> docker-compose.yml")
            print("2. [🚀] Pipeline Maestro -> src/pipeline_master.py")
            print("3. [📊] Dashboard Premium -> dashboard-premium/")
            print("4. [🧪] Pruebas de Calidad -> tests/")
            print("5. [🧹] Limpiar Servicios -> docker-compose.yml")
            print("6. [📝] Ver Historial de Logs -> logs/execution.log")
            print("0. [❌] Salir")
            choice = input("\nSelecciona una opción [0-6]: ")

        if choice == "1":
            run_command(["docker-compose", "up", "-d"], "Levantando PostgreSQL/PostGIS...")
            time.sleep(2)
        elif choice == "2":
            run_command([sys.executable, "src/pipeline_master.py"], "Ejecutando Inteligencia de Negocio...", is_long_running=True, extra_env={"PYTHONPATH": "src"})
            if HAS_RICH:
                Prompt.ask("\n[bold green]Pipeline Terminado.[/bold green] Presiona Enter para volver al menú...")
            else:
                input("\nPipeline Terminado. Presiona Enter para volver al menú...")
        elif choice == "3":
            if HAS_RICH:
                console.print("\n[bold blue]Lanzando Dashboard en el navegador...[/bold blue]")
            else:
                print("\n[Lanzando Dashboard en el navegador...]")
            run_command(["npm", "--prefix", "dashboard-premium", "run", "dev"], "Dashboard Premium Activo", is_long_running=True)
        elif choice == "4":
            run_command([sys.executable, "-m", "pytest", "tests/", "-v"], "Validando lógica espacial y cognitiva...", is_long_running=True)
            if HAS_RICH:
                Prompt.ask("\nPresiona Enter para continuar...")
            else:
                input("\nPresiona Enter para continuar...")
        elif choice == "5":
            run_command(["docker-compose", "down"], "Deteniendo contenedores y liberando recursos...")
            time.sleep(2)
        elif choice == "6":
            log_path = os.path.join("logs", "execution.log")
            if HAS_RICH:
                if os.path.exists(log_path):
                    with open(log_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        last_lines = "".join(lines[-25:])
                        console.print(Panel(last_lines, title="Últimos logs de ejecución", border_style="yellow"))
                else:
                    console.print("[red]Aún no hay logs generados. Ejecuta el pipeline primero.[/red]")
                Prompt.ask("\nPresiona Enter para continuar...")
            else:
                if os.path.exists(log_path):
                    print("\n--- Últimos logs de ejecución ---")
                    with open(log_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for line in lines[-25:]:
                            print(line.strip())
                    print("---------------------------------")
                else:
                    print("[!] Aún no hay logs generados. Ejecuta el pipeline primero.")
                input("\nPresiona Enter para continuar...")
        elif choice == "0":
            print("Hasta pronto, Data Engineer!")
            break

if __name__ == "__main__":
    main_menu()
