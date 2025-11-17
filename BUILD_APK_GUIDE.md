# Hướng dẫn Build APK cho Android

## Yêu cầu
- Node.js đã cài đặt
- Android Studio đã cài đặt
- Android SDK đã cấu hình
- Java JDK đã cài đặt

## Các bước build APK

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Prebuild (tạo native code)
```bash
npx expo prebuild --platform android
```

### 3. Build APK Debug (để test)

**Windows:**
```bash
cd android
gradlew.bat assembleDebug
```

**Linux/Mac:**
```bash
cd android
./gradlew assembleDebug
```

APK sẽ được tạo tại: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Build APK Release (để phân phối)

#### Bước 4.1: Tạo keystore (chỉ cần làm 1 lần)
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Nhập thông tin:
- Password: (nhập password, nhớ lưu lại)
- Tên, tổ chức, v.v.

#### Bước 4.2: Cấu hình keystore trong Gradle

Tạo file `android/gradle.properties` (nếu chưa có) và thêm:
```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=<password bạn đã nhập>
MYAPP_RELEASE_KEY_PASSWORD=<password bạn đã nhập>
```

#### Bước 4.3: Cấu hình signing config

Mở file `android/app/build.gradle` và tìm phần `signingConfigs`, thêm config cho release:

Tìm dòng:
```gradle
signingConfigs {
    debug {
        ...
    }
}
```

Thay đổi thành:
```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
    }
}
```

Và trong phần `buildTypes`, tìm `release` và thay đổi:
```gradle
buildTypes {
    release {
        signingConfig signingConfigs.release  // Thay đổi từ signingConfigs.debug
        ...
    }
}
```

#### Bước 4.4: Build APK Release

**Windows:**
```bash
cd android
gradlew.bat assembleRelease
```

**Linux/Mac:**
```bash
cd android
./gradlew assembleRelease
```

APK sẽ được tạo tại: `android/app/build/outputs/apk/release/app-release.apk`

### 5. Build AAB (Android App Bundle) - cho Google Play Store

**Windows:**
```bash
cd android
gradlew.bat bundleRelease
```

**Linux/Mac:**
```bash
cd android
./gradlew bundleRelease
```

AAB sẽ được tạo tại: `android/app/build/outputs/bundle/release/app-release.aab`

## Lưu ý

1. **Keystore**: Giữ file keystore cẩn thận, nếu mất sẽ không thể update app trên Play Store
2. **Password**: Lưu password keystore ở nơi an toàn
3. **Build size**: APK release thường nhỏ hơn debug
4. **Testing**: Test APK release trước khi phân phối

## Troubleshooting

### Lỗi "SDK location not found"
- Tạo file `android/local.properties` với nội dung:
```
sdk.dir=C\:\\Users\\<username>\\AppData\\Local\\Android\\Sdk
```

### Lỗi "Execution failed for task ':app:mergeReleaseResources'"
- Chạy: `cd android && ./gradlew clean`

### Lỗi về keystore
- Đảm bảo file keystore đúng đường dẫn
- Kiểm tra password trong `gradle.properties`

