# Блокування потоків: Lock

Потоки спільно використовують пам'ять, і саме це робить їх зручними, але й небезпечними. Коли два потоки одночасно оновлюють ті самі дані, оновлення можуть непомітно губитися. Така помилка називається **станом гонитви** (race condition). Блокування `threading.Lock` пропускає до коду, що працює зі спільними даними, лише один потік за раз і цим запобігає гонитві.

## Що ви дізнаєтесь

- Що таке стан гонитви і чому код «прочитати-змінити-записати» вразливий
- Чому GIL не робить ваш код потокобезпечним
- Як користуватися `threading.Lock` через `acquire()`/`release()` і, краще, через `with`
- Як побудувати потокобезпечний клас
- Що таке взаємні блокування (deadlock), чому `Lock` не є реентерабельним і коли потрібен `RLock`
- Які ще є засоби синхронізації (`Semaphore`, `Event`, `queue.Queue`, ...)

## Що таке стан гонитви

**Стан гонитви** виникає, коли результат програми залежить від того, як у часі чергуються потоки, що без узгодження звертаються до спільних даних, і хоча б один із них пише. Типова жертва — послідовність **«прочитати-змінити-записати»** (read-modify-write):

1. прочитати поточне значення;
2. обчислити з нього нове значення;
3. записати нове значення назад.

Якщо інший потік змінить значення між кроками 1 і 3, перший потік перезапише цю зміну значенням, обчисленим із застарілих даних. Одне оновлення губиться.

```text
counter = 0

потік t1                     потік t2
читає counter   -> 0
                             читає counter   -> 0
обчислює 0 + 10 -> 10
                             обчислює 0 + 20 -> 20
пише counter = 10
                             пише counter = 20      (+10 від t1 втрачено)

результат: 20, очікували: 30
```

Потік, що записує останнім, «виграє гонитву», і результат залежить від везіння.

## Приклад стану гонитви

`sleep(0.1)` нижче імітує роботу між читанням і записом. Він розширює проміжок між кроками, тож гонитва стається щоразу:

```python
from threading import Thread
from time import sleep

counter = 0


def increase(by):
    global counter

    local_counter = counter  # 1. читаємо
    local_counter += by      # 2. змінюємо

    sleep(0.1)               # імітуємо роботу: тим часом працюють інші потоки

    counter = local_counter  # 3. записуємо
    print(f"counter={counter}")


# створюємо потоки
t1 = Thread(target=increase, args=(10,))
t2 = Thread(target=increase, args=(20,))

# запускаємо потоки
t1.start()
t2.start()

# чекаємо, поки потоки завершаться
t1.join()
t2.join()

print(f"The final counter is {counter}")
```

Результат (зазвичай; якщо `t2` випадково запише першим, ви отримаєте `counter=20`, `counter=10` і підсумок `10`):

```text
counter=10
counter=20
The final counter is 20
```

Обидва потоки прочитали `0`, перш ніж будь-який із них щось записав. `t1` записав `10`, потім `t2` перезаписав його на `20`. Правильна сума `30` так і не з'являється.

### «Але ж `counter += 1` — це один рядок»

Один рядок Python — не один неподільний крок. `dis` показує, що `counter += 1` складається з читання, додавання й запису:

```python
import dis

counter = 0


def increment():
    global counter
    counter += 1


dis.dis(increment)
```

Результат (Python 3.14; в інших версіях трохи інакше):

```text
  6           RESUME                   0

  8           LOAD_GLOBAL              0 (counter)
              LOAD_SMALL_INT           1
              BINARY_OP               13 (+=)
              STORE_GLOBAL             0 (counter)
              LOAD_CONST               1 (None)
              RETURN_VALUE
```

Перемикання потоків між `LOAD_GLOBAL` і `STORE_GLOBAL` губить оновлення.

### GIL вас не захищає

GIL дозволяє виконувати байт-код лише одному потоку водночас, але може перейти від одного потоку до іншого **між** інструкціями байт-коду, просто посеред вашого «прочитати-змінити-записати». У сучасному CPython перемикання відбувається лише в певних точках (наприклад, під час виклику функцій та на ітераціях циклу), тож гонитва може довго ховатися, а потім проявитися, коли зміниться код чи версія Python. Програма нижче губить оновлення, бо між читанням і записом стоїть виклик функції. `sys.setswitchinterval()` робить перемикання потоків значно частішими, тож помилка проявляється надійно:

```python
import sys
from threading import Thread

sys.setswitchinterval(1e-6)  # перемикаємо потоки дуже часто, щоб виявити гонитву

counter = 0


def plus_one(value):
    return value + 1


def increment_many(times):
    global counter
    for _ in range(times):
        counter = plus_one(counter)  # читаємо, викликаємо функцію, записуємо


threads = [Thread(target=increment_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {counter}")
```

Результат (число щоразу інше):

```text
expected 2000000, got 1007692
```

Приблизно половину збільшень втрачено. З типовим інтервалом перемикання (5 мс) та сама програма зазвичай працює правильно і лише зрідка помиляється. Це найгірший різновид помилок: такі, що проходять ваші тести. У збірці CPython без GIL потоки справді працюють паралельно, і незахищені оновлення ламаються ще легше.

> **Зверніть увагу:** окремі операції з вбудованими контейнерами, як-от `list.append()` чи `dict[key] = value`, у CPython потокобезпечні і з GIL, і у збірках без GIL (це деталь реалізації, а не гарантія мови). Послідовності операцій («перевірити, потім діяти», «прочитати, потім записати») — ні. Захищайте їх блокуванням.

## Використання блокування

**Блокування** (lock), яке ще називають **м'ютексом** (mutex, від *mutual exclusion* — взаємне виключення), — це примітив синхронізації, що надає одному потоку виключний доступ до спільного ресурсу. Він має два стани:

- **розблоковано**: наступний потік, який викличе `acquire()`, захоплює блокування й працює далі;
- **заблоковано**: будь-який інший потік, що викличе `acquire()`, **блокується** й чекає, доки власник не викличе `release()`.

Код між захопленням і звільненням називають **критичною секцією** (critical section). Усередині неї одночасно може бути лише один потік.

```python
from threading import Lock

lock = Lock()  # нове блокування створюється розблокованим
```

### `acquire()` і `release()`

Базовий API поєднує `acquire()` з `release()`. Розміщуйте `release()` у блоці `finally`: якщо критична секція згенерує виняток і блокування так і не звільниться, кожен інший потік, що на нього чекає, зависне назавжди.

```python
from threading import Lock, Thread
from time import sleep

counter = 0


def increase(by, lock):
    global counter

    lock.acquire()
    try:
        local_counter = counter
        local_counter += by

        sleep(0.1)

        counter = local_counter
        print(f"counter={counter}")
    finally:
        lock.release()  # виконується, навіть якщо код вище згенерує виняток


lock = Lock()

# створюємо потоки
t1 = Thread(target=increase, args=(10, lock))
t2 = Thread(target=increase, args=(20, lock))

# запускаємо потоки
t1.start()
t2.start()

# чекаємо, поки потоки завершаться
t1.join()
t2.join()

print(f"The final counter is {counter}")
```

Результат (перший рядок може бути `counter=20`, якщо `t2` захопить блокування першим; підсумок завжди 30):

```text
counter=10
counter=30
The final counter is 30
```

Обидва потоки отримують **той самий** об'єкт `Lock`. Це принципово: блокування захищає дані, лише якщо кожен потік, що їх торкається, використовує одне й те саме блокування.

### Інструкція `with` (рекомендовано)

Блокування є менеджером контексту. `with lock:` захоплює його на вході й звільняє на виході, навіть коли виникає виняток. Це коротше й безпечніше, ніж викликати `acquire()` і `release()` самому:

```python
from threading import Lock, Thread
from time import perf_counter, sleep

counter = 0


def increase(by, lock):
    global counter

    with lock:
        local_counter = counter
        local_counter += by

        sleep(0.1)

        counter = local_counter
        print(f"counter={counter}")


lock = Lock()
start = perf_counter()

threads = [Thread(target=increase, args=(by, lock)) for by in (10, 20)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"The final counter is {counter}")
print(f"It took {perf_counter() - start:.1f} s")
```

Результат (порядок перших двох рядків може змінюватися, підсумок завжди 30):

```text
counter=10
counter=30
The final counter is 30
It took 0.2 s
```

Зверніть увагу на ціну: тепер програма триває 0,2 секунди замість 0,1, бо потоки виконують критичну секцію **по черзі**. Робіть критичні секції короткими. Повільну роботу (мережеві виклики, сон, важкі обчислення) виконуйте **поза** блокуванням, а блокуйте лише саме оновлення.

### Більше про `acquire()`

`acquire()` може також спробувати без очікування або чекати обмежений час. Метод повертає `True`, якщо блокування вдалося захопити:

```python
from threading import Lock

lock = Lock()
print("locked?", lock.locked())

print("acquired:", lock.acquire())
print("locked?", lock.locked())

# друга спроба не чекає: blocking=False одразу повертає False
print("acquired again (non-blocking):", lock.acquire(blocking=False))

# або чекає не довше 0.1 с
print("acquired again (timeout 0.1 s):", lock.acquire(timeout=0.1))

lock.release()
print("locked?", lock.locked())

try:
    lock.release()
except RuntimeError as exc:
    print("RuntimeError:", exc)
```

Результат:

```text
locked? False
acquired: True
locked? True
acquired again (non-blocking): False
acquired again (timeout 0.1 s): False
locked? False
RuntimeError: release unlocked lock
```

Використовуючи `blocking=False` або `timeout=`, завжди перевіряйте повернене значення і викликайте `release()`, лише якщо блокування справді захоплено.

## Потокобезпечний клас `Counter`

Найчистіше рішення — тримати блокування **разом із даними, які воно захищає**, усередині класу. Викликачі не можуть забути про блокування, бо ніколи не торкаються даних напряму:

```python
from threading import Lock, Thread
from time import sleep


class Counter:
    def __init__(self):
        self.value = 0
        self.lock = Lock()

    def increase(self, by):
        with self.lock:
            current_value = self.value
            current_value += by

            sleep(0.1)

            self.value = current_value
            print(f"counter={self.value}")


def main():
    counter = Counter()

    # створюємо потоки
    t1 = Thread(target=counter.increase, args=(10,))
    t2 = Thread(target=counter.increase, args=(20,))

    # запускаємо потоки
    t1.start()
    t2.start()

    # чекаємо, поки потоки завершаться
    t1.join()
    t2.join()

    print(f"The final counter is {counter.value}")


if __name__ == "__main__":
    main()
```

Результат (перший рядок може бути `counter=20`; підсумок завжди 30):

```text
counter=10
counter=30
The final counter is 30
```

`target=counter.increase` передає **зв'язаний метод** (bound method), тож кожен потік викликає `increase()` того самого об'єкта `Counter` і використовує його єдине блокування.

## Взаємні блокування

**Взаємне блокування** (deadlock) — це ситуація, коли потоки вічно чекають один на одного. Блокування роблять можливими два його різновиди.

### `Lock` не реентерабельний: для вкладеного блокування є `RLock`

Звичайний `Lock` не пам'ятає, хто ним володіє. Якщо потік, що вже тримає його, знову викличе `acquire()`, він вічно чекатиме сам на себе. Це легко стається, коли один метод із блокуванням викликає інший метод із блокуванням того самого об'єкта. `threading.RLock` (*реентерабельне* блокування, reentrant lock) може кілька разів захопити потік-власник. Воно звільняється, коли цей потік викличе `release()` стільки ж разів.

```python
import threading


class Inventory:
    def __init__(self, lock):
        self._lock = lock
        self._items = {}

    def add(self, name, qty):
        with self._lock:
            self._items[name] = self._items.get(name, 0) + qty

    def add_many(self, pairs):
        with self._lock:          # захоплюємо блокування ...
            for name, qty in pairs:
                self.add(name, qty)  # ... і add() захоплює його ще раз

    def snapshot(self):
        with self._lock:
            return dict(self._items)


inv = Inventory(threading.RLock())
inv.add_many([("apple", 3), ("pear", 2)])
print(inv.snapshot())

# Той самий код зі звичайним Lock назавжди заблокувався б усередині add().
# Тут лише перевіряємо, що звичайний Lock не можна захопити двічі:
plain = threading.Lock()
plain.acquire()
print("second acquire by the same thread:", plain.acquire(timeout=0.2))
plain.release()
```

Результат:

```text
{'apple': 3, 'pear': 2}
second acquire by the same thread: False
```

### Кілька блокувань у різному порядку

Якщо потік 1 тримає блокування A й чекає на B, а потік 2 тримає B й чекає на A, жоден не може продовжити роботу. Демонстрація нижче використовує тайм-аут, щоб завершитися замість зависнути, і `Barrier`, щоб обидва потоки тримали перше блокування, доки обидва не зроблять спробу:

```python
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()
both_tried = threading.Barrier(2)


def worker(name, first, second):
    with first:
        time.sleep(0.1)  # даємо іншому потоку захопити його перше блокування
        # справжня програма чекала б тут вічно; ми здаємося через 0.5 с
        got_both = second.acquire(timeout=0.5)
        if got_both:
            second.release()
        both_tried.wait()  # тримаємо `first`, доки обидва потоки не спробують
    print(f"{name}: {'got both locks' if got_both else 'gave up, deadlock'}")


t1 = threading.Thread(target=worker, args=("t1", lock_a, lock_b))
t2 = threading.Thread(target=worker, args=("t2", lock_b, lock_a))  # зворотний порядок!
t1.start()
t2.start()
t1.join()
t2.join()
```

Результат (порядок рядків може змінюватися):

```text
t2: gave up, deadlock
t1: gave up, deadlock
```

Стандартні ліки — **фіксований порядок блокувань**: кожен потік, якому потрібні обидва блокування, захоплює їх в однаковому порядку.

```python
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()


def worker(name):
    with lock_a:      # кожен потік спершу захоплює lock_a ...
        time.sleep(0.1)
        with lock_b:  # ... а вже потім lock_b
            print(f"{name}: got both locks")


threads = [threading.Thread(target=worker, args=(name,)) for name in ("t1", "t2")]
for t in threads:
    t.start()
for t in threads:
    t.join()
```

Результат:

```text
t1: got both locks
t2: got both locks
```

Ще краще — спроєктувати код так, щоб потоку ніколи не було потрібно більше одного блокування водночас.

## Інші засоби синхронізації

Модулі `threading` і `queue` пропонують більше, ніж `Lock`:

| Засіб | Коли використовувати |
|---|---|
| `RLock` | Той самий потік може захоплювати блокування повторно (вкладені виклики) |
| `Semaphore(n)` / `BoundedSemaphore(n)` | Ресурсом одночасно можуть користуватися щонайбільше *n* потоків (наприклад, 3 з'єднання) |
| `Event` | Один потік сигналізує іншим, що «щось сталося» (наприклад, «зупинись») |
| `Condition` | Потоки чекають, доки зміниться певний стан; до умови прив'язане блокування |
| `Barrier(n)` | Усі *n* потоків мають дійти до певної точки, перш ніж будь-який продовжить |
| `queue.Queue` | Потоки безпечно передають один одному роботу або результати |

Часто найкращий спосіб обійтися без блокувань — **взагалі не ділити змінюваний стан**. Нехай потоки передають дані через `queue.Queue`, яка робить усе блокування всередині себе:

```python
import queue
import threading

tasks = queue.Queue()
results = queue.Queue()


def worker():
    while True:
        n = tasks.get()
        if n is None:  # сигнальне значення (sentinel): роботи більше немає
            break
        results.put(n * n)


threads = [threading.Thread(target=worker) for _ in range(3)]
for t in threads:
    t.start()

for n in range(1, 6):
    tasks.put(n)
for _ in threads:
    tasks.put(None)  # по одному сигнальному значенню на робочий потік

for t in threads:
    t.join()

print(sorted(results.get() for _ in range(results.qsize())))
```

Результат:

```text
[1, 4, 9, 16, 25]
```

## Типові помилки

- **Створювати блокування всередині функції.** `lock = Lock()` у функції потоку дає кожному потоку *власне* блокування, яке нічого не захищає. Створіть одне блокування й поділіть його між потоками (змінна рівня модуля або атрибут об'єкта, який ви захищаєте). Див. вправу 1.
- **`acquire()` без `try`/`finally`.** Виняток у критичній секції залишить блокування захопленим назавжди. Використовуйте `with lock:`.
- **Блокувати лише запис.** Послідовність «перевірити, потім діяти» (`if balance >= amount: balance -= amount`) має тримати блокування і під час перевірки, і під час оновлення. Інакше два потоки можуть пройти перевірку, перш ніж будь-який із них оновить значення.
- **Тримати блокування під час повільної роботи.** Сон, мережеві виклики чи важкі обчислення в критичній секції змушують потоки працювати по черзі. Блокуйте лише оновлення спільного стану.
- **Викликати метод із блокуванням з іншого такого методу, коли це звичайний `Lock`.** Потік потрапляє у взаємне блокування сам із собою. Перебудуйте код або використайте `RLock`.
- **Захоплювати кілька блокувань у непослідовному порядку.** Це може призвести до взаємного блокування. Завжди дотримуйтеся одного глобального порядку.
- **Вважати, що GIL робить код потокобезпечним.** Він не захищає багатокрокові операції, а у збірках без GIL його взагалі немає.
- **Перевірити один раз і вирішити, що гонитви немає.** Гонитва залежить від часу. Правильність має випливати з проєктування, а не з вдалого запуску тесту.

## Підсумок

- Стан гонитви виникає, коли потоки без узгодження звертаються до спільних даних і результат залежить від чергування в часі. Класичний випадок — послідовності «прочитати-змінити-записати».
- Навіть `counter += 1` — це кілька інструкцій байт-коду. GIL не робить цю операцію атомарною.
- `threading.Lock` (м'ютекс) пропускає до критичної секції лише один потік за раз. `acquire()` блокує потік, доки блокування не звільниться, `release()` звільняє його.
- Віддавайте перевагу `with lock:`. Ця форма завжди звільняє блокування, навіть після винятку.
- Усі потоки мають використовувати **той самий** об'єкт блокування. Найчистіше рішення — тримати блокування в класі, якому належать дані.
- Робіть критичні секції короткими, бо код у них виконується по одному потоку за раз.
- `Lock` не реентерабельний. Для вкладеного блокування беріть `RLock`, а кілька блокувань захоплюйте у фіксованому порядку, щоб уникнути взаємних блокувань.
- Розгляньте `queue.Queue`, `Semaphore`, `Event` та інші примітиви або взагалі уникайте спільного змінюваного стану.

## Практика

### Вправа 1: Знайдіть помилку

Цей код використовує блокування, але все одно губить оновлення. Поясніть чому й виправте.

```python
import sys
from threading import Lock, Thread

sys.setswitchinterval(1e-6)  # робимо перемикання потоків частими

total = 0


def plus_one(value):
    return value + 1


def add_many(times):
    global total
    lock = Lock()
    for _ in range(times):
        with lock:
            total = plus_one(total)


threads = [Thread(target=add_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {total}")
```

### Вправа 2: Потокобезпечний банківський рахунок

Напишіть клас `BankAccount` з методами `deposit(amount)`, `withdraw(amount)` і властивістю (property) `balance` лише для читання. `withdraw()` має повертати `False` і не змінювати баланс, якщо грошей недостатньо, і `True` в іншому разі. Усередині `withdraw()` між перевіркою й оновленням викличте `time.sleep(0.01)`, щоб імітувати повільну систему. Почніть з балансу 100, нехай 10 потоків спробують зняти по 30, і виведіть, скільки зняттів удалося, та підсумковий баланс. Баланс ніколи не має ставати від'ємним.

### Вправа 3: Обмежте конкурентність семафором

Імітуйте 6 завантажень по 0,1 секунди в 6 потоках, але дозвольте щонайбільше 2 одночасні завантаження за допомогою `threading.Semaphore`. Відстежуйте, скільки завантажень активні одночасно (захистіть цей лічильник блокуванням `Lock`), і виведіть максимум, а також загальний час.

### Вправа 4: Завантажити лише раз

П'ять потоків одночасно викликають `get_config()`. Функція має викликати повільну `load_config()` лише під час першого виклику й кешувати результат. Версія нижче викликає її п'ять разів. Виправте її за допомогою блокування, щоб `load_config()` виконувалася рівно один раз, а наступні виклики лишалися швидкими (коли конфігурацію вже завантажено, їм не повинно бути потрібне блокування).

```python
import threading
import time

_config = None
load_count = 0


def load_config():
    global load_count
    load_count += 1
    time.sleep(0.1)  # читаємо файл, розбираємо...
    return {"debug": False}


def get_config():
    global _config
    if _config is None:
        _config = load_config()
    return _config


threads = [threading.Thread(target=get_config) for _ in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("load_config() calls:", load_count)
```

## Розв'язки

### Вправа 1

Кожен виклик `add_many()` створює **власний** `Lock`, тож кожен потік блокує інший об'єкт, і ніхто ні на кого не чекає. Помилкова версія виводить щось на зразок:

```text
expected 2000000, got 1691914
```

Виправлення — одне блокування, спільне для всіх потоків:

```python
import sys
from threading import Lock, Thread

sys.setswitchinterval(1e-6)  # робимо перемикання потоків частими

total = 0
total_lock = Lock()  # одне блокування, спільне для всіх потоків


def plus_one(value):
    return value + 1


def add_many(times):
    global total
    for _ in range(times):
        with total_lock:
            total = plus_one(total)


threads = [Thread(target=add_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {total}")
```

Результат:

```text
expected 2000000, got 2000000
```

### Вправа 2

```python
import threading
import time


class BankAccount:
    def __init__(self, balance):
        self._balance = balance
        self._lock = threading.Lock()

    def deposit(self, amount):
        with self._lock:
            self._balance += amount

    def withdraw(self, amount):
        with self._lock:  # перевірка й оновлення мають бути під одним блокуванням
            if self._balance < amount:
                return False
            time.sleep(0.01)  # імітуємо повільну банківську систему
            self._balance -= amount
            return True

    @property
    def balance(self):
        with self._lock:
            return self._balance


account = BankAccount(100)
results = []


def try_withdraw():
    results.append(account.withdraw(30))


threads = [threading.Thread(target=try_withdraw) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print("successful withdrawals:", results.count(True))
print("refused withdrawals:", results.count(False))
print("final balance:", account.balance)
```

Результат:

```text
successful withdrawals: 3
refused withdrawals: 7
final balance: 10
```

Без блокування кілька потоків могли б пройти перевірку `self._balance < amount` під час `sleep()`, перш ніж будь-який із них відніме суму, і баланс став би від'ємним. Тут сон навмисно стоїть у критичній секції, бо він зображує частину самого оновлення. `results.append()` — одна потокобезпечна операція, тож `results` не потребує блокування.

### Вправа 3

```python
import threading
import time

slots = threading.Semaphore(2)  # щонайбільше 2 завантаження одночасно
stats_lock = threading.Lock()
active = 0
max_active = 0


def download(n):
    global active, max_active
    with slots:
        with stats_lock:
            active += 1
            max_active = max(max_active, active)
        time.sleep(0.1)  # імітуємо завантаження
        with stats_lock:
            active -= 1


start = time.perf_counter()
threads = [threading.Thread(target=download, args=(n,)) for n in range(6)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print("max concurrent downloads:", max_active)
print(f"took {time.perf_counter() - start:.1f} s")
```

Результат (час може трохи відрізнятися):

```text
max concurrent downloads: 2
took 0.3 s
```

`Semaphore(2)` має два «дозволи». Кожен `with slots:` забирає один, а третій потік чекає, доки дозвіл не повернуть. Шість завантажень парами тривають 3 × 0,1 секунди. Зверніть увагу: сон стоїть поза `stats_lock`, тож блокування тримається лише на час крихітних оновлень лічильника.

### Вправа 4

```python
import threading
import time

_config = None
_config_lock = threading.Lock()
load_count = 0


def load_config():
    global load_count
    load_count += 1
    time.sleep(0.1)  # читаємо файл, розбираємо...
    return {"debug": False}


def get_config():
    global _config
    if _config is None:              # швидкий шлях: після завантаження без блокування
        with _config_lock:
            if _config is None:      # перевіряємо ще раз: інший потік міг уже завантажити
                _config = load_config()
    return _config


threads = [threading.Thread(target=get_config) for _ in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("load_config() calls:", load_count)
print(get_config())
```

Результат:

```text
load_config() calls: 1
{'debug': False}
```

Цей прийом називається **блокуванням із подвійною перевіркою** (double-checked locking). Перша перевірка пропускає блокування, коли конфігурація вже існує. Друга перевірка, всередині блокування, обов'язкова: кілька потоків можуть пройти першу перевірку в ту саму мить, і завантажити конфігурацію має лише той, хто першим захопить блокування. Решта, отримавши блокування, побачать, що `_config` уже встановлено. Оскільки `load_config()` викликається лише під `_config_lock`, її `load_count += 1` теж захищено.

---

*Джерело: [pythontutorial.net — Python Threading Lock](https://www.pythontutorial.net/advanced-python/python-threading-lock/). Адаптовано й доповнено для PyJourney.*
