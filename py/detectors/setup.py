from setuptools import setup, find_packages

setup(
    name="detectors",
    version="0.1.0",
    packages=find_packages(
        include=["*"],
        exclude=[
            "*_test",
            "__pycache__",
        ],
    ),
    install_requires=[
        "ultralytics>=8.0.0",
        "opencv-python>=4.11.0",
        "torch>=2.9.0",
        "mediapipe>=0.10.0",
    ],
    python_requires=">=3.8",
    author="kylehue",
    description="Collection of real-time detectors (phone, face, hands, etc.)",
    url="https://github.com/kylehue/distract",
)
