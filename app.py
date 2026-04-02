import sys
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QPushButton, QTableWidget, 
                             QTableWidgetItem, QLineEdit, QFrame, QStackedWidget,
                             QFileDialog, QComboBox, QMessageBox, QProgressDialog)
from PyQt6.QtCore import Qt, QVariant
from PyQt6.QtGui import QFont
from data_store import DataStore, ExcelImporter, BankStore, ImportLogStore, ImportLog


def format_tl(amount: float) -> str:
    return f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Harmoni Finans")
        self.setGeometry(100, 100, 1000, 700)
        self.importer = None
        self.data_store = DataStore()
        self.bank_store = BankStore()
        self.import_log_store = ImportLogStore()
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        self.stacked_widget = QStackedWidget()
        main_layout.addWidget(self.stacked_widget)
        
        self.main_page = self.create_main_page()
        self.import_page = self.create_import_page()
        self.dataview_page = self.create_dataview_page()
        self.history_page = self.create_history_page()
        
        self.stacked_widget.addWidget(self.main_page)
        self.stacked_widget.addWidget(self.import_page)
        self.stacked_widget.addWidget(self.dataview_page)
        self.stacked_widget.addWidget(self.history_page)
        
        self.nav_bar = self.create_nav_bar()
        main_layout.addWidget(self.nav_bar)
        
        self.stacked_widget.setCurrentIndex(0)
    
    def create_nav_bar(self):
        nav_frame = QFrame()
        nav_frame.setFrameShape(QFrame.Shape.StyledPanel)
        nav_layout = QHBoxLayout(nav_frame)
        nav_layout.setContentsMargins(20, 10, 20, 10)
        
        btn_main = QPushButton("Ana Sayfa")
        btn_import = QPushButton("İçe Aktar")
        btn_history = QPushButton("Geçmiş")
        
        btn_main.clicked.connect(lambda: self.stacked_widget.setCurrentIndex(0))
        btn_import.clicked.connect(lambda: self.stacked_widget.setCurrentIndex(1))
        btn_history.clicked.connect(lambda: self.go_to_history())
        
        for btn in [btn_main, btn_import, btn_history]:
            btn.setMinimumHeight(40)
            nav_layout.addWidget(btn)
        
        return nav_frame
    
    def create_main_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        
        title = QLabel("Hoş Geldiniz")
        title.setFont(QFont("", 24, QFont.Weight.Bold))
        layout.addWidget(title)
        
        subtitle = QLabel("Harmoni Finans - Finansal Veri Yönetim Sistemi")
        layout.addWidget(subtitle)
        
        month_card = QFrame()
        month_card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        month_layout = QVBoxLayout(month_card)
        
        month_title = QLabel("Aylık Özet")
        month_title.setFont(QFont("", 14, QFont.Weight.Bold))
        month_layout.addWidget(month_title)
        
        selector_layout = QHBoxLayout()
        selector_layout.addWidget(QLabel("Ay:"))
        
        self.combo_month = QComboBox()
        months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
        month_names = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        self.combo_month.addItems([f"{m}. {n}" for m, n in zip(months, month_names)])
        selector_layout.addWidget(self.combo_month)
        
        self.combo_year = QComboBox()
        years = [str(y) for y in range(2020, 2031)]
        self.combo_year.addItems(years)
        selector_layout.addWidget(self.combo_year)
        
        selector_layout.addWidget(QLabel("Banka:"))
        self.combo_bank_filter = QComboBox()
        self.combo_bank_filter.addItem("Tümü")
        banks = self.bank_store.get_all()
        self.combo_bank_filter.addItems(banks)
        selector_layout.addWidget(self.combo_bank_filter)
        
        btn_show = QPushButton("Göster")
        btn_show.clicked.connect(self.show_monthly_summary)
        selector_layout.addWidget(btn_show)
        
        btn_view_all = QPushButton("Tümünü Gör")
        btn_view_all.clicked.connect(self.go_to_dataview)
        selector_layout.addWidget(btn_view_all)
        
        month_layout.addLayout(selector_layout)
        
        self.month_summary_label = QLabel("")
        month_layout.addWidget(self.month_summary_label)
        
        self.lbl_main_gelir = QLabel("Gelir: -")
        self.lbl_main_gider = QLabel("Gider: -")
        self.lbl_main_net = QLabel("Net: -")
        self.lbl_main_bakiye = QLabel("Kümülatif Bakiye: -")
        
        for lbl in [self.lbl_main_gelir, self.lbl_main_gider, self.lbl_main_net, self.lbl_main_bakiye]:
            lbl.setFont(QFont("", 12))
            month_layout.addWidget(lbl)
        
        self.main_table = QTableWidget(0, 4)
        self.main_table.setHorizontalHeaderLabels(["Tarih", "Tutar", "Banka", "Açıklama"])
        month_layout.addWidget(self.main_table, 1)
        
        self._main_table_sorted = False
        
        layout.addWidget(month_card)
        
        return page
    
    def show_monthly_summary(self):
        month_idx = self.combo_month.currentIndex() + 1
        year = self.combo_year.currentText()
        selected_bank = self.combo_bank_filter.currentText()
        
        month_str = f"{month_idx:02d}"
        start_date = f"{year}-{month_str}-01"
        
        if month_idx == 12:
            end_date = f"{int(year) + 1}-01-01"
        else:
            end_date = f"{year}-{month_idx + 1:02d}-01"
        
        summary = self.data_store.get_summary(start_date, end_date, selected_bank)
        
        self.lbl_main_gelir.setText(f"Gelir: {format_tl(summary['total_income'])} TL")
        self.lbl_main_gider.setText(f"Gider: {format_tl(summary['total_expense'])} TL")
        self.lbl_main_net.setText(f"Net: {format_tl(summary['net_balance'])} TL")
        
        all_transactions = self.data_store.load()
        if selected_bank == "Tümü" or not selected_bank:
            cumulative = sum(t.value for t in all_transactions if t.datetime < end_date)
        else:
            cumulative = sum(t.value for t in all_transactions if t.datetime < end_date and t.bank_name == selected_bank)
        self.lbl_main_bakiye.setText(f"Kümülatif Bakiye: {format_tl(cumulative)} TL")
        
        transactions = self.data_store.get_by_date_range(start_date, end_date, selected_bank)
        self.main_table.setRowCount(len(transactions))
        for i, t in enumerate(transactions):
            item_date = QTableWidgetItem(t.datetime[:10])
            item_value = QTableWidgetItem(format_tl(t.value))
            item_value.setData(Qt.ItemDataRole.UserRole, t.value)
            self.main_table.setItem(i, 0, item_date)
            self.main_table.setItem(i, 1, item_value)
            self.main_table.setItem(i, 2, QTableWidgetItem(t.bank_name))
            self.main_table.setItem(i, 3, QTableWidgetItem(t.description))
        
        if not self._main_table_sorted:
            self.main_table.setSortingEnabled(True)
            self._main_table_sorted = True
        
        self.main_table.resizeColumnsToContents()
        self.main_table.horizontalHeader().setStretchLastSection(True)
    
    def create_import_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        
        title = QLabel("Veri İçe Aktar")
        title.setFont(QFont("", 20, QFont.Weight.Bold))
        layout.addWidget(title)
        
        card = QFrame()
        card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        card_layout = QVBoxLayout(card)
        
        card_layout.addWidget(QLabel("Excel dosyası seçin"))
        
        btn_select = QPushButton("Dosya Seç")
        btn_select.clicked.connect(self.select_file)
        card_layout.addWidget(btn_select)
        
        self.file_label = QLabel("")
        card_layout.addWidget(self.file_label)
        
        layout.addWidget(card)
        
        self.mapping_card = QFrame()
        self.mapping_card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        self.mapping_layout = QVBoxLayout(self.mapping_card)
        
        self.mapping_layout.addWidget(QLabel("Sütun Eşleştirme:"))
        
        self.combo_datetime = QComboBox()
        self.combo_value = QComboBox()
        self.combo_description = QComboBox()
        
        self.mapping_layout.addWidget(QLabel("Tarih:"))
        self.mapping_layout.addWidget(self.combo_datetime)
        self.mapping_layout.addWidget(QLabel("Tutar:"))
        self.mapping_layout.addWidget(self.combo_value)
        self.mapping_layout.addWidget(QLabel("Açıklama:"))
        self.mapping_layout.addWidget(self.combo_description)
        
        bank_layout = QHBoxLayout()
        bank_layout.addWidget(QLabel("Banka:"))
        self.combo_bank_name = QComboBox()
        banks = self.bank_store.get_all()
        self.combo_bank_name.addItems(banks)
        self.input_bank_name = QLineEdit()
        self.input_bank_name.setPlaceholderText("Yeni banka ekle...")
        btn_add_bank = QPushButton("Ekle")
        btn_add_bank.clicked.connect(self.add_bank)
        bank_layout.addWidget(self.combo_bank_name)
        bank_layout.addWidget(self.input_bank_name)
        bank_layout.addWidget(btn_add_bank)
        self.mapping_layout.addLayout(bank_layout)
        
        self.btn_import = QPushButton("İçe Aktar")
        self.btn_import.setEnabled(False)
        self.btn_import.clicked.connect(self.do_import)
        self.mapping_layout.addWidget(self.btn_import)
        
        self.mapping_card.setVisible(False)
        layout.addWidget(self.mapping_card)
        
        format_card = QFrame()
        format_card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        format_layout = QVBoxLayout(format_card)
        
        format_label = QLabel("Desteklenen Formatlar:")
        format_label.setFont(QFont("", 10, QFont.Weight.Bold))
        format_layout.addWidget(format_label)
        
        format_layout.addWidget(QLabel("• Excel (.xlsx, .xls)"))
        
        layout.addWidget(format_card)
        layout.addStretch()
        
        return page
    
    def create_dataview_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        
        title = QLabel("Veri Görüntüle")
        title.setFont(QFont("", 20, QFont.Weight.Bold))
        layout.addWidget(title)
        
        filter_card = QFrame()
        filter_card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        filter_layout = QHBoxLayout(filter_card)
        
        filter_layout.addWidget(QLabel("Tarih Aralığı:"))
        filter_layout.addWidget(QLabel("Başlangıç:"))
        
        self.start_date = QLineEdit("2020-01-01")
        self.start_date.setFixedWidth(120)
        filter_layout.addWidget(self.start_date)
        
        filter_layout.addWidget(QLabel("Bitiş:"))
        self.end_date = QLineEdit("2030-12-31")
        self.end_date.setFixedWidth(120)
        filter_layout.addWidget(self.end_date)
        
        filter_layout.addWidget(QLabel("Banka:"))
        self.combo_bank_dataview = QComboBox()
        self.combo_bank_dataview.addItem("Tümü")
        filter_layout.addWidget(self.combo_bank_dataview)
        
        btn_filter = QPushButton("Filtrele")
        btn_filter.clicked.connect(self.apply_filter)
        filter_layout.addWidget(btn_filter)
        
        layout.addWidget(filter_card)
        
        summary_card = QFrame()
        summary_card.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        summary_layout = QVBoxLayout(summary_card)
        
        summary_label = QLabel("Özet:")
        summary_label.setFont(QFont("", 10, QFont.Weight.Bold))
        summary_layout.addWidget(summary_label)
        
        self.lbl_income = QLabel("Toplam Gelir: 0.00 TL")
        self.lbl_expense = QLabel("Toplam Gider: 0.00 TL")
        self.lbl_balance = QLabel("Net Bakiye: 0.00 TL")
        
        summary_layout.addWidget(self.lbl_income)
        summary_layout.addWidget(self.lbl_expense)
        summary_layout.addWidget(self.lbl_balance)
        
        layout.addWidget(summary_card)
        
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Tarih", "Tutar", "Banka", "Tür", "Açıklama"])
        layout.addWidget(self.table)
        
        self._dataview_table_sorted = False
        
        return page
    
    def select_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Excel Dosyası Seç", "", "Excel Files (*.xlsx *.xls)"
        )
        
        if not file_path:
            return
        
        self.importer = ExcelImporter(file_path)
        
        if not self.importer.load_file():
            QMessageBox.critical(self, "Hata", "Dosya okunamadı!")
            return
        
        self.file_label.setText(file_path.split("/")[-1])
        
        columns = ["-- Seçin --"] + [str(c) if c else "" for c in self.importer.columns]
        
        for combo in [self.combo_datetime, self.combo_value, self.combo_description]:
            combo.clear()
            combo.addItems(columns)
        
        saved_banks = self.bank_store.get_all()
        default_bank = self.importer.default_bank_name
        
        self.combo_bank_name.clear()
        self.combo_bank_name.addItems(saved_banks)
        
        idx = self.combo_bank_name.findText(default_bank)
        if idx >= 0:
            self.combo_bank_name.setCurrentIndex(idx)
        elif default_bank:
            self.combo_bank_name.setCurrentText(default_bank)
        
        self.mapping_card.setVisible(True)
        self.btn_import.setEnabled(True)
    
    def add_bank(self):
        new_bank = self.input_bank_name.text().strip()
        if new_bank:
            self.bank_store.add(new_bank)
            self.combo_bank_name.addItem(new_bank)
            self.combo_bank_name.setCurrentText(new_bank)
            self.input_bank_name.clear()
    
    def do_import(self):
        if not self.importer:
            return
        
        selected_bank = self.combo_bank_name.currentText().strip()
        new_bank = self.input_bank_name.text().strip()
        
        if new_bank:
            self.bank_store.add(new_bank)
            selected_bank = new_bank
        elif not selected_bank:
            selected_bank = self.importer.default_bank_name
        
        mapping = {
            "datetime": self.combo_datetime.currentText() if self.combo_datetime.currentIndex() > 0 else None,
            "value": self.combo_value.currentText() if self.combo_value.currentIndex() > 0 else None,
            "description": self.combo_description.currentText() if self.combo_description.currentIndex() > 0 else None,
            "bank_name": selected_bank,
        }
        
        if not mapping["datetime"] or not mapping["value"]:
            QMessageBox.warning(self, "Hata", "Tarih ve Tutar alanları zorunludur!")
            return
        
        if mapping["bank_name"]:
            self.bank_store.add(mapping["bank_name"])
        
        progress = QProgressDialog("İçe aktarılıyor...", "İptal", 0, 0, self)
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setCancelButton(None)
        progress.setMinimumDuration(0)
        progress.show()
        QApplication.processEvents()
        
        transactions, errors = self.importer.validate_and_import(mapping)
        
        progress.close()
        
        if errors:
            error_text = "\n".join([f"Satır {e.row}: {e.field} - {e.message}" for e in errors[:20]])
            if len(errors) > 20:
                error_text += f"\n...ve {len(errors) - 20} hata daha"
            
            reply = QMessageBox.question(
                self, "Hatalar Var", 
                f"{len(errors)} hata bulundu.\n\n{error_text}\n\nDevam etmek ister misiniz?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply != QMessageBox.StandardButton.Yes:
                return
        
        for t in transactions:
            self.data_store.add(t)
        
        from datetime import datetime
        log = ImportLog(
            filename=self.file_label.text(),
            row_count=len(transactions),
            datetime=datetime.now().strftime("%d-%m-%Y %H:%M")
        )
        self.import_log_store.add(log)
        
        QMessageBox.information(self, "Başarılı", f"{len(transactions)} işlem içe aktarıldı!")
        
        self.refresh_bank_filter()
        self.refresh_bank_dataview()
        self.reset_import_form()
    
    def reset_import_form(self):
        self.mapping_card.setVisible(False)
        self.file_label.setText("")
        self.combo_datetime.setCurrentIndex(0)
        self.combo_value.setCurrentIndex(0)
        self.combo_description.setCurrentIndex(0)
        self.combo_bank_name.setCurrentIndex(0)
        self.input_bank_name.clear()
        self.importer = None
    
    def refresh_bank_filter(self):
        current = self.combo_bank_filter.currentText()
        self.combo_bank_filter.clear()
        self.combo_bank_filter.addItem("Tümü")
        banks = self.bank_store.get_all()
        self.combo_bank_filter.addItems(banks)
        idx = self.combo_bank_filter.findText(current)
        if idx >= 0:
            self.combo_bank_filter.setCurrentIndex(idx)
    
    def go_to_dataview(self):
        self.stacked_widget.setCurrentIndex(2)
        self.refresh_bank_dataview()
        self.apply_filter()
    
    def refresh_bank_dataview(self):
        current = self.combo_bank_dataview.currentText()
        self.combo_bank_dataview.clear()
        self.combo_bank_dataview.addItem("Tümü")
        banks = self.bank_store.get_all()
        self.combo_bank_dataview.addItems(banks)
        idx = self.combo_bank_dataview.findText(current)
        if idx >= 0:
            self.combo_bank_dataview.setCurrentIndex(idx)
    
    def apply_filter(self):
        start = self.start_date.text()
        end = self.end_date.text()
        selected_bank = self.combo_bank_dataview.currentText()
        
        summary = self.data_store.get_summary(start, end, selected_bank)
        self.lbl_income.setText(f"Toplam Gelir: {format_tl(summary['total_income'])} TL")
        self.lbl_expense.setText(f"Toplam Gider: {format_tl(summary['total_expense'])} TL")
        self.lbl_balance.setText(f"Net Bakiye: {format_tl(summary['net_balance'])} TL")
        
        transactions = self.data_store.get_by_date_range(start, end, selected_bank)
        
        self.table.setRowCount(len(transactions))
        for i, t in enumerate(transactions):
            item_value = QTableWidgetItem(format_tl(t.value))
            item_value.setData(Qt.ItemDataRole.UserRole, t.value)
            self.table.setItem(i, 0, QTableWidgetItem(t.datetime))
            self.table.setItem(i, 1, item_value)
            self.table.setItem(i, 2, QTableWidgetItem(t.bank_name))
            self.table.setItem(i, 3, QTableWidgetItem("Gelir" if t.value >= 0 else "Gider"))
            self.table.setItem(i, 4, QTableWidgetItem(t.description))
        
        if not self._dataview_table_sorted:
            self.table.setSortingEnabled(True)
            self._dataview_table_sorted = True
        
        self.table.resizeColumnsToContents()
        self.table.horizontalHeader().setStretchLastSection(True)
    
    def create_history_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        
        title = QLabel("İçe Aktarma Geçmişi")
        title.setFont(QFont("", 20, QFont.Weight.Bold))
        layout.addWidget(title)
        
        self.history_table = QTableWidget(0, 3)
        self.history_table.setHorizontalHeaderLabels(["Dosya Adı", "Satır Sayısı", "Tarih"])
        layout.addWidget(self.history_table)
        
        return page
    
    def go_to_history(self):
        self.stacked_widget.setCurrentIndex(3)
        self.refresh_history()
    
    def refresh_history(self):
        logs = self.import_log_store.get_all()
        self.history_table.setRowCount(len(logs))
        for i, log in enumerate(logs):
            self.history_table.setItem(i, 0, QTableWidgetItem(log.filename))
            self.history_table.setItem(i, 1, QTableWidgetItem(str(log.row_count)))
            self.history_table.setItem(i, 2, QTableWidgetItem(log.datetime))
        self.history_table.resizeColumnsToContents()
        self.history_table.horizontalHeader().setStretchLastSection(True)


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
