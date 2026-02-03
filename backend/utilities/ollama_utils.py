import ollama

def extract_model_names() -> dict:
    try:
        models_info = ollama.list()
        if hasattr(models_info, "models"):
            model_names = {model.model: model.model for model in models_info.models}
        elif isinstance(models_info, list):
            model_names = {model.get("model"): model.get("model") for model in models_info if model.get("model")}
        else:
            model_names = {}
        return model_names
    except Exception as e:
        print(f"Error extracting model names: {e}")
        return {}
