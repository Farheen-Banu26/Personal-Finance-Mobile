from flask import Flask, jsonify, send_from_directory, request, render_template
from datetime import datetime, timedelta
import json, os, uuid

app = Flask(__name__, static_folder='../static', template_folder='../templates')

USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.json')

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, 'r') as f:
        return json.load(f)

def save_users(data):
    with open(USERS_FILE, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def get_user():
    users = load_users()
    if not users.get('users'):
        return None, users
    return users['users'][0], users

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard_data')
def dashboard_data():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    transactions = user.get('transactions', [])
    income = sum(t['amount'] for t in transactions if t['type']=='income')
    expenses = sum(t['amount'] for t in transactions if t['type']=='expense')
    savings = user.get('savings', 0)
    goals = user.get('goals', [])
    goals_progress = 0
    if goals:
        goals_progress = int(sum(g.get('progress_percent',0) for g in goals)/len(goals))
    budgets = user.get('budgets', [])
    budget_alerts = []
    for b in budgets:
        spent = sum(t['amount'] for t in transactions if t.get('category')==b['category'] and t['type']=='expense')
        if spent > b.get('limit',0):
            budget_alerts.append({'category': b['category'], 'limit': b['limit'], 'spent': spent})
    last_10 = sorted(transactions, key=lambda x: x.get('date',''), reverse=True)[:10]
    return jsonify({
        'income': income,
        'expenses': expenses,
        'savings': savings,
        'goals_progress': goals_progress,
        'transactions': last_10,
        'budgets': budgets,
        'budget_alerts': budget_alerts,
        'user': {'name': user.get('name')}
    })

@app.route('/transactions')
def transactions():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    txs = sorted(user.get('transactions', []), key=lambda x: x.get('date',''), reverse=True)
    return jsonify(txs)

@app.route('/add_transaction', methods=['POST'])
def add_transaction():
    data = request.json
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    tx = {
        'id': str(uuid.uuid4()),
        'title': data.get('title','Untitled'),
        'type': data.get('type','expense'),
        'amount': float(data.get('amount',0)),
        'date': data.get('date', datetime.utcnow().date().isoformat()),
        'category': data.get('category','General')
    }
    user.setdefault('transactions', []).append(tx)
    save_users(users)
    return jsonify(tx)

@app.route('/delete_transaction', methods=['POST'])
def delete_transaction():
    data = request.json
    txid = data.get('id')
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    before = len(user.get('transactions',[]))
    user['transactions'] = [t for t in user.get('transactions',[]) if t.get('id')!=txid]
    save_users(users)
    return jsonify({'deleted': before - len(user.get('transactions',[]))})

@app.route('/budgets', methods=['GET','POST'])
def budgets():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    if request.method == 'GET':
        return jsonify(user.get('budgets', []))
    else:
        data = request.json
        # add or update budget
        budgets = user.setdefault('budgets', [])
        if data.get('id'):
            for b in budgets:
                if b['id']==data['id']:
                    b.update(category=data.get('category', b['category']), limit=float(data.get('limit', b['limit'])))
        else:
            budgets.append({'id': str(uuid.uuid4()), 'category': data.get('category','General'), 'limit': float(data.get('limit',0))})
        save_users(users)
        return jsonify(budgets)

@app.route('/delete_budget', methods=['POST'])
def delete_budget():
    data = request.json
    bid = data.get('id')
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    user['budgets'] = [b for b in user.get('budgets',[]) if b.get('id')!=bid]
    save_users(users)
    return jsonify({'ok': True})

@app.route('/profile', methods=['GET','POST'])
def profile():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    if request.method == 'GET':
        return jsonify({'name': user.get('name'), 'savings': user.get('savings',0)})
    else:
        data = request.json
        user['name'] = data.get('name', user.get('name'))
        user['savings'] = float(data.get('savings', user.get('savings',0)))
        save_users(users)
        return jsonify({'name': user['name'], 'savings': user['savings']})

@app.route('/get_streak')
def get_streak():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    streak = user.get('streak', {})
    return jsonify(streak)

@app.route('/update_active', methods=['POST'])
def update_active():
    user, users = get_user()
    if not user:
        return jsonify({'error':'no users'}), 404
    streak = user.get('streak', {'count':0,'last_active':None})
    today = datetime.utcnow().date()
    last = None
    if streak.get('last_active'):
        last = datetime.fromisoformat(streak['last_active']).date()
    if last == today:
        pass
    elif last == today - timedelta(days=1):
        streak['count'] = streak.get('count',0) + 1
        streak['last_active'] = today.isoformat()
    else:
        streak['count'] = 1
        streak['last_active'] = today.isoformat()
    user['streak'] = streak
    save_users(users)
    return jsonify(streak)

# Serve static files (if needed)
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), '../static'), filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
