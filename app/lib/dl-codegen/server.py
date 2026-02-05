# python/dl-codegen/server.py
# Production Flask + PyTorch server for DL training/inference
from flask import Flask, request, jsonify
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import json
import os
import sys
import threading
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
# Force CPU mode for stability with Gunicorn workers (MPS has multi-process issues)
device = torch.device('cpu')

# Thread lock for model loading (thread-safe for gunicorn workers)
model_lock = threading.Lock()

class DeepCodeNet(nn.Module):
    def __init__(self, input_dim=544, hidden_dims=[512,256,128,64], dropout=0.2):
        super().__init__()
        layers = []
        prev_dim = input_dim
        
        for h in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, h),
                nn.ReLU(),
                nn.BatchNorm1d(h),
                nn.Dropout(dropout)
            ])
            prev_dim = h
        
        layers.append(nn.Linear(prev_dim, 100))  # Vocab size
        self.net = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.net(x)

model = None
optimizer = None
criterion = nn.CrossEntropyLoss()

@app.route('/train', methods=['POST'])
def train():
    global model, optimizer
    data = request.json

    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    dataset = torch.tensor(data['dataset'], dtype=torch.float32)
    targets = torch.randint(0, 100, (dataset.shape[0],))  # Simplified

    train_ds = TensorDataset(dataset, targets)
    loader = DataLoader(train_ds, batch_size=data['config']['batchSize'], shuffle=True)
    
    model = DeepCodeNet().to(device)
    optimizer = optim.Adam(model.parameters(), lr=data['config']['lr'], weight_decay=1e-4)
    
    model.train()
    total_loss, correct, total = 0, 0, 0
    
    for epoch in range(data['config']['epochs']):
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            out = model(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            
            total_loss += loss.item()
            correct += (out.argmax(1) == batch_y).sum().item()
            total += batch_y.size(0)
    
    torch.save(model.state_dict(), data['modelPath'])
    
    return jsonify({
        'loss': total_loss / len(loader),
        'accuracy': correct / total
    })

@app.route('/predict', methods=['POST'])
def predict():
    global model
    data = request.json

    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    try:
        # Thread-safe model loading with double-checked locking
        if model is None:
            with model_lock:
                # Double-check inside lock to prevent race condition
                if model is None:
                    if 'modelPath' not in data or not os.path.exists(data['modelPath']):
                        return jsonify({'error': 'Model file not found or not trained yet'}), 404

                    model = DeepCodeNet()
                    model.load_state_dict(torch.load(data['modelPath'], map_location=device, weights_only=True))
                    model.to(device)
                    model.eval()
                    print(f"[Flask] Model loaded on device: {device}")

        features = torch.tensor([data['features']], dtype=torch.float32).to(device)

        # Ensure model is in eval mode (disables dropout and changes BatchNorm behavior)
        model.eval()
        with torch.no_grad():
            logits = model(features)
            probs = torch.softmax(logits, dim=-1)
            pred = probs.argmax(-1).cpu().numpy()[0]

        return jsonify({'completion_idx': int(pred), 'confidence': float(probs.max())})

    except Exception as e:
        print(f"[Flask] Prediction error: {e}", file=sys.stderr)
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

if __name__ == '__main__':
    os.makedirs('../../.data', exist_ok=True)
    app.run(host='127.0.0.1', port=5001, debug=False)
