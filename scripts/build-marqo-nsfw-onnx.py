#!/usr/bin/env python3
"""Rebuilds assets/models/nsfw_marqo_vit_tiny_384_int8.onnx (second on-device
image safety model) from the public Marqo/nsfw-image-detection-384 weights
(Apache-2.0, https://huggingface.co/Marqo/nsfw-image-detection-384).

    pip install torch==2.14.* torchvision==0.29.* --index-url https://download.pytorch.org/whl/cpu
    pip install timm onnx onnxruntime
    python scripts/build-marqo-nsfw-onnx.py

Input: 1x3x384x384 float, RGB scaled to [-1, 1]. Output: logits [NSFW, SFW].
After rebuilding, update MARQO_SHA256 in plugins/withNsfwClassifier.js.
"""
import torch, timm
from onnxruntime.quantization import quantize_dynamic, QuantType

m = timm.create_model("hf_hub:Marqo/nsfw-image-detection-384", pretrained=True).eval()
torch.onnx.export(m, torch.randn(1, 3, 384, 384), "/tmp/marqo_nsfw_384.onnx",
                  input_names=["input"], output_names=["logits"], opset_version=17, dynamo=False)
quantize_dynamic("/tmp/marqo_nsfw_384.onnx", "assets/models/nsfw_marqo_vit_tiny_384_int8.onnx",
                 weight_type=QuantType.QUInt8)
print("wrote assets/models/nsfw_marqo_vit_tiny_384_int8.onnx")
