"""Helper to invoke Affinity MCP tools via affinity-mcp-bridge.mjs."""

import argparse
import base64
import json
import os
import subprocess
import sys

BRIDGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "affinity-mcp-bridge.mjs")


class AffinityMcpSession:
    """Context manager wrapping a single stdio session through the Affinity MCP bridge."""

    def __init__(self):
        self._proc = None
        self._next_id = 1

    def __enter__(self):
        self._proc = subprocess.Popen(
            ["node", BRIDGE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        init_res = self._rpc(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "palette-design-runner", "version": "1.0"},
            },
        )
        if "error" in init_res:
            raise RuntimeError(f"MCP initialize failed: {init_res}")
        self._notify("notifications/initialized")
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._proc:
            try:
                self._proc.stdin.close()
            except Exception:
                pass
            self._proc.terminate()

    def _notify(self, method, params=None):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._proc.stdin.write(json.dumps(msg) + "\n")
        self._proc.stdin.flush()

    def _rpc(self, method, params=None):
        req_id = self._next_id
        self._next_id += 1
        msg = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            msg["params"] = params
        self._proc.stdin.write(json.dumps(msg) + "\n")
        self._proc.stdin.flush()
        while True:
            line = self._proc.stdout.readline()
            if not line:
                err = self._proc.stderr.read()
                raise RuntimeError(f"MCP bridge closed unexpectedly. stderr={err}")
            obj = json.loads(line)
            if obj.get("id") == req_id:
                return obj

    def list_tools(self):
        return self._rpc("tools/list", {})

    def call_tool(self, name, arguments):
        return self._rpc("tools/call", {"name": name, "arguments": arguments})


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("smoke")

    ex = sub.add_parser("exec")
    ex.add_argument("script_path")

    rnd = sub.add_parser("render-spread")
    rnd.add_argument("doc_uuid")
    rnd.add_argument("spread_index", type=int)
    rnd.add_argument("out_jpg")

    sav = sub.add_parser("save-lib")
    sav.add_argument("title")
    sav.add_argument("description")
    sav.add_argument("script_path")

    args = parser.parse_args()

    with AffinityMcpSession() as s:
        if args.cmd == "smoke":
            tools = s.list_tools()
            names = [t["name"] for t in tools.get("result", {}).get("tools", [])]
            res = s.call_tool(
                "execute_script",
                {"script": 'const { Application } = require("/application.js"); console.log("OK:" + Application.productShortName);'},
            )
            print("TOOLS:", names)
            print("EXEC:", json.dumps(res, ensure_ascii=False))
        elif args.cmd == "exec":
            with open(args.script_path, "r", encoding="utf-8") as fh:
                code = fh.read()
            res = s.call_tool("execute_script", {"script": code})
            print(json.dumps(res, ensure_ascii=False, indent=2))
            if res.get("result", {}).get("isError"):
                sys.exit(1)
        elif args.cmd == "render-spread":
            res = s.call_tool(
                "render_spread",
                {"document_session_uuid": args.doc_uuid, "spread_index": args.spread_index},
            )
            content = res.get("result", {}).get("content", [])
            saved = False
            for item in content:
                if item.get("type") == "image" and "data" in item:
                    os.makedirs(os.path.dirname(args.out_jpg), exist_ok=True)
                    with open(args.out_jpg, "wb") as fh:
                        fh.write(base64.b64decode(item["data"]))
                    saved = True
                    print(f"Saved {args.out_jpg}")
                else:
                    print(json.dumps(item, ensure_ascii=False))
            if not saved or res.get("result", {}).get("isError"):
                sys.exit(1)
        elif args.cmd == "save-lib":
            with open(args.script_path, "r", encoding="utf-8") as fh:
                code = fh.read()
            res = s.call_tool(
                "save_script_to_library",
                {"title": args.title, "description": args.description, "code": code},
            )
            print(json.dumps(res, ensure_ascii=False, indent=2))
            if res.get("result", {}).get("isError"):
                sys.exit(1)


if __name__ == "__main__":
    main()
