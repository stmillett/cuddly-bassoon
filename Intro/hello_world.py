
import time

message = "Hello, World!"

for letter in message:
    print(letter, end='', flush=True)
    time.sleep(1)  # Wait for 1 second before printing the next letter

print()  # Add a newline at the end
