"""Headless adapter for MCP for Blender. Drain bpy commands on the main thread.
The upstream GUI starter uses timers, which do not run in background mode.
"""
import bpy, sys, socket, threading, time
from pathlib import Path
sys.path.insert(0, str(Path.home() / '.config/blender/4.5/scripts/addons'))
import blender_mcp as addon
addon.register()
server = addon.BlenderMCPServer(host='127.0.0.1', port=9876)
server.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.socket.bind((server.host, server.port))
server.socket.listen(5)
server.running = True
server.server_thread = threading.Thread(target=server._server_loop, daemon=True)
server.server_thread.start()
print('BLENDER_MCP_READY', flush=True)
try:
    while server.running:
        server._drain_command_queue()
        time.sleep(.02)
finally:
    server.stop()
