import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FaceDetection } from '@react-native-ml-kit/face-detection';
import ARSticker, { STICKER_TYPES } from './components/ARSticker';
import StickerPicker from './components/StickerPicker';

// 인스타그램 스타일 필터 프리셋
const FILTER_PRESETS = {
  NONE: {
    name: '원본',
    icon: '📷',
    smoothing: 0,
    brightness: 0,
    saturation: 1.0,
    contrast: 1.0,
    warmth: 0,
  },
  CLARENDON: {
    name: 'Clarendon',
    icon: '☀️',
    smoothing: 3,
    brightness: 0.1,
    saturation: 1.35,
    contrast: 1.2,
    warmth: 0.1,
  },
  GINGHAM: {
    name: 'Gingham',
    icon: '🌸',
    smoothing: 2,
    brightness: 0.05,
    saturation: 0.95,
    contrast: 1.05,
    warmth: -0.1,
  },
  JUNO: {
    name: 'Juno',
    icon: '🌿',
    smoothing: 3,
    brightness: 0.12,
    saturation: 1.4,
    contrast: 1.15,
    warmth: 0.2,
  },
  LARK: {
    name: 'Lark',
    icon: '🌅',
    smoothing: 2,
    brightness: 0.08,
    saturation: 1.2,
    contrast: 0.9,
    warmth: 0.15,
  },
  MOON: {
    name: 'Moon',
    icon: '🌙',
    smoothing: 5,
    brightness: 0.15,
    saturation: 0.7,
    contrast: 1.1,
    warmth: -0.2,
  },
  VINTAGE: {
    name: '빈티지',
    icon: '📸',
    smoothing: 4,
    brightness: -0.05,
    saturation: 0.8,
    contrast: 1.25,
    warmth: 0.3,
  },
  BW: {
    name: '흑백',
    icon: '⚫',
    smoothing: 3,
    brightness: 0.05,
    saturation: 0,
    contrast: 1.2,
    warmth: 0,
  },
  SEPIA: {
    name: '세피아',
    icon: '🍂',
    smoothing: 3,
    brightness: 0.1,
    saturation: 0.5,
    contrast: 1.1,
    warmth: 0.4,
  },
  NASHVILLE: {
    name: 'Nashville',
    icon: '🎸',
    smoothing: 2,
    brightness: 0.12,
    saturation: 1.2,
    contrast: 1.2,
    warmth: 0.25,
  },
  HUDSON: {
    name: 'Hudson',
    icon: '❄️',
    smoothing: 2,
    brightness: 0.1,
    saturation: 1.1,
    contrast: 1.25,
    warmth: -0.15,
  },
};

const { width, height } = Dimensions.get('window');

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('front');
  const [isActive, setIsActive] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  
  // 필터 설정
  const [smoothing, setSmoothing] = useState(5);
  const [brightness, setBrightness] = useState(0);
  const [saturation, setSaturation] = useState(1.1);
  const [contrast, setContrast] = useState(1.0);
  const [warmth, setWarmth] = useState(0);
  const [filtersEnabled, setFiltersEnabled] = useState(true);
  
  // 고급 뷰티 설정
  const [eyeEnlarge, setEyeEnlarge] = useState(0);
  const [faceSlim, setFaceSlim] = useState(0);
  const [chinSlim, setChinSlim] = useState(0);
  const [noseSlim, setNoseSlim] = useState(0);
  const [beautyMode, setBeautyMode] = useState('basic'); // 'basic' or 'advanced'
  
  // AR 스티커 설정
  const [selectedSticker, setSelectedSticker] = useState(STICKER_TYPES.NONE);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  // 필터 프리셋 관련
  const [selectedPreset, setSelectedPreset] = useState('NONE');
  const [showFilterPresets, setShowFilterPresets] = useState(false);
  
  // Before/After 비교
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [compareSlider, setCompareSlider] = useState(0.5);
  const [originalPhoto, setOriginalPhoto] = useState(null);
  
  // 커스텀 프리셋 저장
  const [savedPresets, setSavedPresets] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  const camera = useRef(null);
  const device = useCameraDevice(cameraPosition);
  const faceCount = useSharedValue(0);
  const faceLandmarks = useSharedValue(null); // 얼굴 랜드마크 저장

  // 저장된 프리셋 로드
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const saved = await AsyncStorage.getItem('customPresets');
      if (saved) {
        setSavedPresets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('프리셋 로드 오류:', error);
    }
  };

  // 필터 프리셋 적용
  const applyFilterPreset = (presetKey) => {
    const preset = FILTER_PRESETS[presetKey];
    if (preset) {
      setSmoothing(preset.smoothing);
      setBrightness(preset.brightness);
      setSaturation(preset.saturation);
      setContrast(preset.contrast);
      setWarmth(preset.warmth);
      setSelectedPreset(presetKey);
    }
  };

  // 현재 설정을 프리셋으로 저장
  const saveCurrentAsPreset = async () => {
    if (!presetName.trim()) {
      Alert.alert('오류', '프리셋 이름을 입력해주세요.');
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name: presetName,
      smoothing,
      brightness,
      saturation,
      contrast,
      warmth,
      eyeEnlarge,
      faceSlim,
      chinSlim,
      noseSlim,
    };

    try {
      const updated = [...savedPresets, newPreset];
      await AsyncStorage.setItem('customPresets', JSON.stringify(updated));
      setSavedPresets(updated);
      setPresetName('');
      setShowSaveModal(false);
      Alert.alert('성공', '프리셋이 저장되었습니다!');
    } catch (error) {
      console.error('프리셋 저장 오류:', error);
      Alert.alert('오류', '프리셋을 저장할 수 없습니다.');
    }
  };

  // 저장된 프리셋 불러오기
  const loadCustomPreset = (preset) => {
    setSmoothing(preset.smoothing);
    setBrightness(preset.brightness);
    setSaturation(preset.saturation);
    setContrast(preset.contrast);
    setWarmth(preset.warmth);
    setEyeEnlarge(preset.eyeEnlarge || 0);
    setFaceSlim(preset.faceSlim || 0);
    setChinSlim(preset.chinSlim || 0);
    setNoseSlim(preset.noseSlim || 0);
  };

  // 저장된 프리셋 삭제
  const deleteCustomPreset = async (presetId) => {
    Alert.alert(
      '프리셋 삭제',
      '정말 이 프리셋을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = savedPresets.filter(p => p.id !== presetId);
              await AsyncStorage.setItem('customPresets', JSON.stringify(updated));
              setSavedPresets(updated);
            } catch (error) {
              console.error('프리셋 삭제 오류:', error);
            }
          },
        },
      ]
    );
  };

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      const microphonePermission = await Camera.requestMicrophonePermission();
      
      setHasPermission(
        cameraPermission === 'granted' && microphonePermission === 'granted'
      );

      if (cameraPermission !== 'granted') {
        Alert.alert('카메라 권한 필요', '앱을 사용하려면 카메라 권한이 필요합니다.');
      }
    })();
  }, []);

  // 얼굴 감지 프레임 프로세서
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    if (!filtersEnabled && beautyMode === 'basic') return;

    try {
      // 얼굴 감지 (3프레임마다 실행 - 성능 최적화)
      if (frame.timestamp % 3 === 0) {
        const faces = FaceDetection.detectFaces(frame);
        faceCount.value = faces.length;
        
        runOnJS(setFaceDetected)(faces.length > 0);
        
        // 고급 모드에서는 랜드마크 저장
        if (beautyMode === 'advanced' && faces.length > 0) {
          const face = faces[0];
          
          // 얼굴 랜드마크 추출
          faceLandmarks.value = {
            leftEye: face.leftEyePosition,
            rightEye: face.rightEyePosition,
            noseBase: face.noseBasePosition,
            leftCheek: face.leftCheekPosition,
            rightCheek: face.rightCheekPosition,
            leftMouth: face.leftMouthPosition,
            rightMouth: face.rightMouthPosition,
            bounds: face.boundingBox,
          };
        }
      }
    } catch (error) {
      console.log('Frame processing error:', error);
    }
  }, [filtersEnabled, beautyMode]);

  // 사진 촬영
  const takePicture = useCallback(async () => {
    if (!camera.current) return;

    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
        enableShutterSound: true,
      });

      // 원본 사진 저장 (Before/After 비교용)
      setOriginalPhoto(photo.path);

      // 필터 적용한 사진 처리
      let processedPath = photo.path;

      if (filtersEnabled) {
        processedPath = await applyFiltersToImage(photo.path);
      }

      // 갤러리에 저장
      const fileName = `BeautyCamera_${Date.now()}.jpg`;
      const destPath = `${RNFS.PicturesDirectoryPath}/${fileName}`;
      
      await RNFS.copyFile(processedPath, destPath);
      
      setCapturedPhoto(destPath);
      
      Alert.alert(
        '저장 완료',
        '사진이 갤러리에 저장되었습니다!',
        [
          { 
            text: 'Before/After 보기', 
            onPress: () => setShowBeforeAfter(true) 
          },
          { 
            text: '확인', 
            onPress: () => {
              setCapturedPhoto(null);
              setOriginalPhoto(null);
              setShowBeforeAfter(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('사진 촬영 오류:', error);
      Alert.alert('오류', '사진을 저장할 수 없습니다.');
    }
  }, [filtersEnabled, smoothing, brightness, saturation, contrast, warmth]);

  // 이미지에 필터 적용 (네이티브 처리)
  const applyFiltersToImage = async (imagePath) => {
    // 실제로는 react-native-image-filter-kit 사용
    // 여기서는 간단한 버전
    try {
      const outputPath = `${RNFS.CachesDirectoryPath}/filtered_${Date.now()}.jpg`;
      
      // TODO: 실제 필터 적용 로직
      // ImageFilterKit을 사용하여 smoothing, brightness, saturation 적용
      
      return outputPath;
    } catch (error) {
      console.error('필터 적용 오류:', error);
      return imagePath;
    }
  };

  // 카메라 전환
  const switchCamera = () => {
    setCameraPosition(prev => prev === 'front' ? 'back' : 'front');
  };

  // 설정 초기화
  const resetSettings = () => {
    setSmoothing(5);
    setBrightness(0);
    setSaturation(1.1);
    setContrast(1.0);
    setWarmth(0);
    setEyeEnlarge(0);
    setFaceSlim(0);
    setChinSlim(0);
    setNoseSlim(0);
    setSelectedPreset('NONE');
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          카메라 권한을 허용해주세요
        </Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          카메라를 찾을 수 없습니다
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 카메라 뷰 */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive && !capturedPhoto}
          photo={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />

        {/* 오버레이 */}
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <View style={[
              styles.faceIndicator,
              faceDetected && styles.faceDetectedIndicator
            ]}>
              <Text style={styles.faceText}>
                {faceDetected ? '✅ 얼굴 감지됨' : '⏳ 얼굴 찾는중'}
              </Text>
            </View>
          </View>

          {/* AR 스티커 렌더링 */}
          {selectedSticker !== STICKER_TYPES.NONE && faceDetected && (
            <ARSticker
              stickerType={selectedSticker}
              landmarks={faceLandmarks.value}
              screenDimensions={{ width, height }}
              animated={true}
            />
          )}

          {/* 스티커 선택 버튼 */}
          <TouchableOpacity
            style={styles.stickerButton}
            onPress={() => setShowStickerPicker(!showStickerPicker)}
          >
            <Text style={styles.stickerButtonText}>
              {selectedSticker === STICKER_TYPES.NONE ? '🎭' : '✨'}
            </Text>
          </TouchableOpacity>

          {/* 필터 프리셋 버튼 */}
          <TouchableOpacity
            style={styles.filterPresetButton}
            onPress={() => setShowFilterPresets(!showFilterPresets)}
          >
            <Text style={styles.filterPresetButtonText}>🎨</Text>
          </TouchableOpacity>

          {/* 카메라 전환 버튼 */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={switchCamera}
          >
            <Text style={styles.switchButtonText}>🔄</Text>
          </TouchableOpacity>

          {/* 캡처 버튼 */}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>

        {/* 촬영한 사진 미리보기 */}
        {capturedPhoto && (
          <View style={styles.previewContainer}>
            {showBeforeAfter && originalPhoto ? (
              // Before/After 비교 모드
              <View style={styles.compareContainer}>
                <View style={styles.compareHeader}>
                  <Text style={styles.compareTitle}>📸 Before / After</Text>
                  <TouchableOpacity
                    onPress={() => setShowBeforeAfter(false)}
                  >
                    <Text style={styles.compareToggle}>단일 보기</Text>
                  </TouchableOpacity>
                </View>
                
                {/* 2분할 화면 */}
                <View style={styles.splitView}>
                  <View style={[styles.splitHalf, styles.splitLeft]}>
                    <Image
                      source={{ uri: `file://${originalPhoto}` }}
                      style={styles.splitImage}
                    />
                    <View style={styles.splitLabel}>
                      <Text style={styles.splitLabelText}>원본</Text>
                    </View>
                  </View>
                  <View style={[styles.splitHalf, styles.splitRight]}>
                    <Image
                      source={{ uri: `file://${capturedPhoto}` }}
                      style={styles.splitImage}
                    />
                    <View style={styles.splitLabel}>
                      <Text style={styles.splitLabelText}>필터 적용</Text>
                    </View>
                  </View>
                </View>

                {/* 슬라이더 비교 */}
                <View style={styles.sliderCompareContainer}>
                  <Text style={styles.sliderCompareLabel}>
                    슬라이더로 비교하기
                  </Text>
                  <View style={styles.sliderCompareView}>
                    <Image
                      source={{ uri: `file://${capturedPhoto}` }}
                      style={styles.sliderCompareImage}
                    />
                    <View 
                      style={[
                        styles.sliderCompareOverlay,
                        { width: `${compareSlider * 100}%` }
                      ]}
                    >
                      <Image
                        source={{ uri: `file://${originalPhoto}` }}
                        style={styles.sliderCompareImage}
                      />
                    </View>
                    <View 
                      style={[
                        styles.sliderLine,
                        { left: `${compareSlider * 100}%` }
                      ]}
                    />
                  </View>
                  <Slider
                    style={styles.compareSlider}
                    minimumValue={0}
                    maximumValue={1}
                    value={compareSlider}
                    onValueChange={setCompareSlider}
                    minimumTrackTintColor="#667eea"
                    maximumTrackTintColor="#e0e0e0"
                    thumbTintColor="#667eea"
                  />
                </View>
              </View>
            ) : (
              // 일반 미리보기 모드
              <>
                <Image
                  source={{ uri: `file://${capturedPhoto}` }}
                  style={styles.previewImage}
                />
                {originalPhoto && (
                  <TouchableOpacity
                    style={styles.compareButton}
                    onPress={() => setShowBeforeAfter(true)}
                  >
                    <Text style={styles.compareButtonText}>
                      📊 Before/After
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity
              style={styles.closePreview}
              onPress={() => {
                setCapturedPhoto(null);
                setOriginalPhoto(null);
                setShowBeforeAfter(false);
              }}
            >
              <Text style={styles.closePreviewText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 컨트롤 패널 */}
      <View style={styles.controls}>
        <Text style={styles.title}>🎨 뷰티 필터</Text>

        {/* 필터 프리셋 선택 */}
        {showFilterPresets && (
          <View style={styles.presetPanel}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.presetScroll}
            >
              {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.presetCard,
                    selectedPreset === key && styles.presetCardActive
                  ]}
                  onPress={() => applyFilterPreset(key)}
                >
                  <Text style={styles.presetIcon}>{preset.icon}</Text>
                  <Text style={styles.presetName}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* 저장된 커스텀 프리셋 */}
            {savedPresets.length > 0 && (
              <>
                <Text style={styles.savedPresetsTitle}>내 프리셋</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.presetScroll}
                >
                  {savedPresets.map((preset) => (
                    <View key={preset.id} style={styles.customPresetCard}>
                      <TouchableOpacity
                        style={styles.customPresetButton}
                        onPress={() => loadCustomPreset(preset)}
                      >
                        <Text style={styles.presetIcon}>⭐</Text>
                        <Text style={styles.presetName}>{preset.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deletePresetButton}
                        onPress={() => deleteCustomPreset(preset.id)}
                      >
                        <Text style={styles.deletePresetText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {/* 프리셋 저장 버튼 */}
            <TouchableOpacity
              style={styles.savePresetButton}
              onPress={() => setShowSaveModal(true)}
            >
              <Text style={styles.savePresetButtonText}>
                💾 현재 설정을 프리셋으로 저장
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 스티커 선택 패널 */}
        {showStickerPicker && (
          <StickerPicker
            selectedSticker={selectedSticker}
            onSelectSticker={(sticker) => {
              setSelectedSticker(sticker);
              // 스티커 선택 시 자동으로 패널 닫기 (선택사항)
              // setShowStickerPicker(false);
            }}
          />
        )}

        {/* 모드 전환 버튼 */}
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              beautyMode === 'basic' && styles.modeButtonActive
            ]}
            onPress={() => setBeautyMode('basic')}
          >
            <Text style={[
              styles.modeButtonText,
              beautyMode === 'basic' && styles.modeButtonTextActive
            ]}>
              기본 필터
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modeButton,
              beautyMode === 'advanced' && styles.modeButtonActive
            ]}
            onPress={() => setBeautyMode('advanced')}
          >
            <Text style={[
              styles.modeButtonText,
              beautyMode === 'advanced' && styles.modeButtonTextActive
            ]}>
              고급 보정
            </Text>
          </TouchableOpacity>
        </View>

        {/* 필터 ON/OFF */}
        <TouchableOpacity
          style={[
            styles.toggleButton,
            filtersEnabled && styles.toggleButtonActive
          ]}
          onPress={() => setFiltersEnabled(!filtersEnabled)}
        >
          <Text style={styles.toggleButtonText}>
            {filtersEnabled ? '✅ 필터 ON' : '⭕ 필터 OFF'}
          </Text>
        </TouchableOpacity>

        {/* 기본 필터 */}
        {beautyMode === 'basic' && (
          <>
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>✨ 피부 보정: {smoothing}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={smoothing}
                onValueChange={setSmoothing}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>
                ☀️ 밝기: {brightness > 0 ? '+' : ''}{brightness}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={-30}
                maximumValue={30}
                step={1}
                value={brightness}
                onValueChange={setBrightness}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>
                🌈 채도: {Math.round(saturation * 100)}%
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={2.0}
                step={0.1}
                value={saturation}
                onValueChange={setSaturation}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>
          </>
        )}

        {/* 고급 뷰티 효과 */}
        {beautyMode === 'advanced' && (
          <>
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>👁️ 눈 확대: {eyeEnlarge}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={eyeEnlarge}
                onValueChange={setEyeEnlarge}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>🎭 얼굴 슬리밍: {faceSlim}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={faceSlim}
                onValueChange={setFaceSlim}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>💎 V라인 턱: {chinSlim}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={chinSlim}
                onValueChange={setChinSlim}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>👃 코 보정: {noseSlim}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={noseSlim}
                onValueChange={setNoseSlim}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>✨ 피부 보정: {smoothing}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={smoothing}
                onValueChange={setSmoothing}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />
            </View>
          </>
        )}

        {/* 초기화 버튼 */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetSettings}
        >
          <Text style={styles.resetButtonText}>🔄 초기화</Text>
        </TouchableOpacity>
      </View>

      {/* 프리셋 저장 모달 */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>프리셋 저장</Text>
            <Text style={styles.modalSubtitle}>
              현재 필터 설정을 저장합니다
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="프리셋 이름 입력"
              value={presetName}
              onChangeText={setPresetName}
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowSaveModal(false);
                  setPresetName('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={saveCurrentAsPreset}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSave]}>
                  저장
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    padding: 20,
    paddingTop: 50,
  },
  faceIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  faceDetectedIndicator: {
    backgroundColor: 'rgba(102, 126, 234, 0.8)',
  },
  faceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  switchButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  stickerButton: {
    position: 'absolute',
    top: 110,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterPresetButton: {
    position: 'absolute',
    top: 170,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterPresetButtonText: {
    fontSize: 24,
  },
  switchButtonText: {
    fontSize: 24,
  },
  stickerButtonText: {
    fontSize: 24,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 30,
  },
  captureButtonInner: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#fff',
  },
  previewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  closePreview: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  compareButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.9)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  compareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compareContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  compareTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  compareToggle: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  splitView: {
    flexDirection: 'row',
    height: 300,
  },
  splitHalf: {
    flex: 1,
    position: 'relative',
  },
  splitLeft: {
    borderRightWidth: 2,
    borderRightColor: '#667eea',
  },
  splitRight: {
    borderLeftWidth: 2,
    borderLeftColor: '#667eea',
  },
  splitImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  splitLabel: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  splitLabelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  sliderCompareContainer: {
    padding: 20,
    flex: 1,
  },
  sliderCompareLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  sliderCompareView: {
    height: 300,
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden',
  },
  sliderCompareImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sliderCompareOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    overflow: 'hidden',
  },
  sliderLine: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: '100%',
    backgroundColor: '#667eea',
  },
  compareSlider: {
    width: '100%',
    height: 40,
    marginTop: 20,
  },
  presetPanel: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  presetScroll: {
    marginBottom: 10,
  },
  presetCard: {
    width: 90,
    alignItems: 'center',
    padding: 12,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#e8ecff',
  },
  presetIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  presetName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  savedPresetsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
    marginTop: 10,
    marginBottom: 10,
  },
  customPresetCard: {
    position: 'relative',
    marginRight: 10,
  },
  customPresetButton: {
    width: 90,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  deletePresetButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePresetText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  savePresetButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  savePresetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonSave: {
    backgroundColor: '#667eea',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonTextSave: {
    color: '#fff',
  },
  controls: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#e8ecff',
    borderColor: '#667eea',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: '#667eea',
  },
  toggleButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  toggleButtonActive: {
    backgroundColor: '#667eea',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  sliderContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  resetButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
