import psutil
import pandas as pd
import os
import json

df_default = None

def get_default_power_usages():
    global df_default
    if df_default is None:
        # --- Process Default Model Data ---
        default_file_path = 'configs/default_power_consumptions.json'
        df_default = pd.DataFrame()
        if os.path.exists(default_file_path) and os.path.getsize(default_file_path) > 0:
            with open(default_file_path, 'r') as f:
                default_data = json.load(f)
            df_default = pd.DataFrame(list(default_data.items()), columns=['model', 'power'])
            df_default['type'] = 'Cloud API'
    return df_default

def get_cpu_power_usage():
    try:
        # Approximate by calculating power per logical CPU
        load = psutil.cpu_percent(interval=1)
        return load
    except Exception as e:
        return None


def get_gpu_power_usage():
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        power = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000  # milliwatts to watts
        name = pynvml.nvmlDeviceGetName(handle)
        pynvml.nvmlShutdown()
        return power, name.decode("utf-8") if isinstance(name, bytes) else name
    except Exception as e:
        return None, None

def get_power_usage_history(local_file_path):
    df_local = pd.DataFrame()
    if os.path.exists(local_file_path) and os.path.getsize(local_file_path) > 0:
        df_local = pd.read_json(local_file_path)
        if not df_local.empty:
            df_local['date'] = pd.to_datetime(df_local['date'])
    return df_local